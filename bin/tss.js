// Copyright (c) Claus Reinke. All rights reserved.
// Licensed under the Apache License, Version 2.0.
// See LICENSE.txt in the project root for complete license information.
///<reference path='typings/node/node.d.ts'/>
///<reference path='node_modules/typescript/bin/typescript.d.ts'/>
///<reference path='node_modules/typescript/bin/typescript_internal.d.ts'/>
var ts = require("typescript");
var harness = require("./harness");
function switchToForwardSlashes(path) {
    return path.replace(/\\/g, "/");
}
// bypass import, we don't want to drop out of the global module;
// use fixed readline (https://github.com/joyent/node/issues/3305),
// fixed version should be in nodejs from about v0.9.9/v0.8.19?
var readline = require("./readline");
var EOL = require("os").EOL;
var FileCache = (function () {
    function FileCache() {
        this.fileNames = [];
        this.snapshots = {};
        this.fileNameToScript = {};
    }
    FileCache.prototype.getFileNames = function () { return this.fileNames; };
    FileCache.prototype.getScriptInfo = function (fileName) { return this.fileNameToScript[fileName]; };
    FileCache.prototype.getScriptSnapshot = function (fileName) { return this.snapshots[fileName]; };
    FileCache.prototype.addFile = function (fileName, text) {
        this.fileNames.push(fileName);
        this.fileNameToScript[fileName] = new harness.ScriptInfo(fileName, text);
        this.snapshots[fileName] = new harness.ScriptSnapshot(this.getScriptInfo(fileName));
    };
    /**
     * @param line 1 based index
     * @param col 1 based index
     */
    FileCache.prototype.lineColToPosition = function (fileName, line, col) {
        var script = this.fileNameToScript[fileName];
        return ts.computePositionOfLineAndCharacter(script.lineMap, line - 1, col - 1);
    };
    /**
     * @returns {line,character} 1 based indices
     */
    FileCache.prototype.positionToLineCol = function (fileName, position) {
        var script = this.fileNameToScript[fileName];
        var lineChar = ts.computeLineAndCharacterOfPosition(script.lineMap, position);
        return { line: lineChar.line + 1, character: lineChar.character + 1 };
    };
    /**
     * @param line 1 based index
     */
    FileCache.prototype.getLineText = function (fileName, line) {
        var script = this.fileNameToScript[fileName];
        var lineMap = script.lineMap;
        var lineStart = ts.computePositionOfLineAndCharacter(lineMap, line - 1, 0);
        var lineEnd = ts.computePositionOfLineAndCharacter(lineMap, line, 0) - 1;
        var lineText = script.content.substring(lineStart, lineEnd);
        return lineText;
    };
    FileCache.prototype.updateScript = function (fileName, content) {
        var script = this.fileNameToScript[fileName];
        if (script) {
            script.updateContent(content);
            this.snapshots[fileName] = new harness.ScriptSnapshot(script);
        }
        else {
            this.addFile(fileName, content);
        }
    };
    FileCache.prototype.editScript = function (fileName, minChar, limChar, newText) {
        var script = this.fileNameToScript[fileName];
        if (script) {
            script.editContent(minChar, limChar, newText);
            this.snapshots[fileName] = new harness.ScriptSnapshot(script);
            return;
        }
        throw new Error("No script with name '" + fileName + "'");
    };
    return FileCache;
})();
/** TypeScript Services Server,
    an interactive commandline tool
    for getting info on .ts projects */
var TSS = (function () {
    function TSS(prettyJSON) {
        if (prettyJSON === void 0) { prettyJSON = false; }
        this.prettyJSON = prettyJSON;
    } // NOTE: call setup
    TSS.prototype.resolveRelativePath = function (path, directory) {
        var unQuotedPath = path; // better be.. ts.stripStartAndEndQuotes(path);
        var normalizedPath;
        if (ts.isRootedDiskPath(unQuotedPath) || !directory) {
            normalizedPath = unQuotedPath;
        }
        else {
            normalizedPath = ts.combinePaths(directory, unQuotedPath);
        }
        // get the absolute path
        normalizedPath = ts.sys.resolvePath(normalizedPath);
        // Switch to forward slashes
        normalizedPath = switchToForwardSlashes(normalizedPath)
            .replace(/^(.:)/, function (_, drive) { return drive.toLowerCase(); });
        return normalizedPath;
    };
    TSS.prototype.getErrors = function () {
        var _this = this;
        var addPhase = function (phase) { return function (d) { d.phase = phase; return d; }; };
        var errors = [];
        this.fileCache.getFileNames().map(function (file) {
            var syntactic = _this.ls.getSyntacticDiagnostics(file);
            var semantic = _this.ls.getSemanticDiagnostics(file);
            // this.ls.languageService.getEmitOutput(file).diagnostics;
            errors = errors.concat(syntactic.map(addPhase("Syntax")), semantic.map(addPhase("Semantics")));
        });
        return errors;
    };
    /** load file and dependencies, prepare language service for queries */
    TSS.prototype.setup = function (files, options) {
        var _this = this;
        this.rootFiles = files.map(function (file) { return _this.resolveRelativePath(file); });
        this.compilerOptions = options;
        // build program from root files,
        // chase dependencies (references and imports), normalize file names, ...
        this.compilerHost = ts.createCompilerHost(this.compilerOptions);
        this.program = ts.createProgram(this.rootFiles, this.compilerOptions, this.compilerHost);
        this.fileCache = new FileCache();
        //TODO: diagnostics
        this.program.getSourceFiles().forEach(function (source) {
            var fileName = _this.resolveRelativePath(source.fileName);
            _this.fileCache.addFile(fileName, source.text);
        });
        // Get a language service
        this.lsHost = {
            getCompilationSettings: function () { return _this.compilerOptions; },
            getScriptFileNames: function () { return _this.fileCache.getFileNames(); },
            getScriptVersion: function (fileName) { return _this.fileCache.getScriptInfo(fileName).version.toString(); },
            getScriptIsOpen: function (fileName) { return _this.fileCache.getScriptInfo(fileName).isOpen; },
            getScriptSnapshot: function (fileName) { return _this.fileCache.getScriptSnapshot(fileName); },
            getCurrentDirectory: function () { return ts.sys.getCurrentDirectory(); },
            getDefaultLibFileName: function (options) { return ts.getDefaultLibFileName(options); },
            log: function (message) { return undefined; },
            trace: function (message) { return undefined; },
            error: function (message) { return console.error(message); } // ??
        };
        this.ls = ts.createLanguageService(this.lsHost, ts.createDocumentRegistry());
    };
    TSS.prototype.output = function (info, excludes) {
        if (excludes === void 0) { excludes = ["displayParts"]; }
        var replacer = function (k, v) { return excludes.indexOf(k) !== -1 ? undefined : v; };
        if (info) {
            console.log(JSON.stringify(info, replacer, this.prettyJSON ? " " : undefined).trim());
        }
        else {
            console.log(JSON.stringify(info, replacer));
        }
    };
    TSS.prototype.outputJSON = function (json) {
        console.log(json.trim());
    };
    TSS.prototype.handleNavBarItem = function (file, item) {
        var _this = this;
        // TODO: under which circumstances can item.spans.length be other than 1?
        return { info: [item.kindModifiers, item.kind, item.text].filter(function (s) { return s !== ""; }).join(" "),
            kindModifiers: item.kindModifiers,
            kind: item.kind,
            text: item.text,
            min: this.fileCache.positionToLineCol(file, item.spans[0].start),
            lim: this.fileCache.positionToLineCol(file, item.spans[0].start + item.spans[0].length),
            childItems: item.childItems.map(function (item) { return _this.handleNavBarItem(file, item); })
        };
    };
    /** commandline server main routine: commands in, JSON info out */
    TSS.prototype.listen = function () {
        var _this = this;
        var line;
        var col;
        var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        var cmd, pos, file, script, added, range, check, def, refs, locs, info, source, brief, member, navbarItems, pattern;
        var collecting = 0, on_collected_callback, lines = [];
        var commands = {};
        function match(cmd, regexp) {
            commands[regexp.source] = true;
            return cmd.match(regexp);
        }
        rl.on('line', function (input) {
            var m;
            try {
                cmd = input.trim();
                if (collecting > 0) {
                    lines.push(input);
                    collecting--;
                    if (collecting === 0) {
                        on_collected_callback();
                    }
                }
                else if (m = match(cmd, /^signature (\d+) (\d+) (.*)$/)) {
                    (function () {
                        line = parseInt(m[1]);
                        col = parseInt(m[2]);
                        file = _this.resolveRelativePath(m[3]);
                        pos = _this.fileCache.lineColToPosition(file, line, col);
                        info = _this.ls.getSignatureHelpItems(file, pos);
                        var param = function (p) { return ({ name: p.name,
                            isOptional: p.isOptional,
                            type: ts.displayPartsToString(p.displayParts) || "",
                            docComment: ts.displayPartsToString(p.documentation) || ""
                        }); };
                        info && (info.items = info.items
                            .map(function (item) { return ({ prefix: ts.displayPartsToString(item.prefixDisplayParts) || "",
                            separator: ts.displayPartsToString(item.separatorDisplayParts) || "",
                            suffix: ts.displayPartsToString(item.suffixDisplayParts) || "",
                            parameters: item.parameters.map(param),
                            docComment: ts.displayPartsToString(item.documentation) || ""
                        }); }));
                        _this.output(info);
                    })();
                }
                else if (m = match(cmd, /^(type|quickInfo) (\d+) (\d+) (.*)$/)) {
                    line = parseInt(m[2]);
                    col = parseInt(m[3]);
                    file = _this.resolveRelativePath(m[4]);
                    pos = _this.fileCache.lineColToPosition(file, line, col);
                    info = (_this.ls.getQuickInfoAtPosition(file, pos) || {});
                    info.type = ((info && ts.displayPartsToString(info.displayParts)) || "");
                    info.docComment = ((info && ts.displayPartsToString(info.documentation)) || "");
                    _this.output(info);
                }
                else if (m = match(cmd, /^definition (\d+) (\d+) (.*)$/)) {
                    line = parseInt(m[1]);
                    col = parseInt(m[2]);
                    file = _this.resolveRelativePath(m[3]);
                    pos = _this.fileCache.lineColToPosition(file, line, col);
                    locs = _this.ls.getDefinitionAtPosition(file, pos); // NOTE: multiple definitions
                    info = locs.map(function (def) { return ({
                        def: def,
                        file: def && def.fileName,
                        min: def && _this.fileCache.positionToLineCol(def.fileName, def.textSpan.start),
                        lim: def && _this.fileCache.positionToLineCol(def.fileName, ts.textSpanEnd(def.textSpan))
                    }); });
                    // TODO: what about multiple definitions?
                    _this.output(info[0] || null);
                }
                else if (m = match(cmd, /^(references|occurrences) (\d+) (\d+) (.*)$/)) {
                    line = parseInt(m[2]);
                    col = parseInt(m[3]);
                    file = _this.resolveRelativePath(m[4]);
                    pos = _this.fileCache.lineColToPosition(file, line, col);
                    switch (m[1]) {
                        case "references":
                            refs = _this.ls.getReferencesAtPosition(file, pos);
                            break;
                        case "occurrences":
                            refs = _this.ls.getOccurrencesAtPosition(file, pos);
                            break;
                        default:
                            throw "cannot happen";
                    }
                    info = (refs || []).map(function (ref) {
                        var start, end, fileName, lineText;
                        if (ref) {
                            start = _this.fileCache.positionToLineCol(ref.fileName, ref.textSpan.start);
                            end = _this.fileCache.positionToLineCol(ref.fileName, ts.textSpanEnd(ref.textSpan));
                            fileName = _this.resolveRelativePath(ref.fileName);
                            lineText = _this.fileCache.getLineText(fileName, start.line);
                        }
                        return {
                            ref: ref,
                            file: ref && ref.fileName,
                            lineText: lineText,
                            min: start,
                            lim: end
                        };
                    });
                    _this.output(info);
                }
                else if (m = match(cmd, /^navigationBarItems (.*)$/)) {
                    file = _this.resolveRelativePath(m[1]);
                    _this.output(_this.ls.getNavigationBarItems(file)
                        .map(function (item) { return _this.handleNavBarItem(file, item); }));
                }
                else if (m = match(cmd, /^navigateToItems (.*)$/)) {
                    pattern = m[1];
                    info = _this.ls.getNavigateToItems(pattern)
                        .map(function (item) {
                        item['min'] = _this.fileCache.positionToLineCol(item.fileName, item.textSpan.start);
                        item['lim'] = _this.fileCache.positionToLineCol(item.fileName, item.textSpan.start
                            + item.textSpan.length);
                        return item;
                    });
                    _this.output(info);
                }
                else if (m = match(cmd, /^completions(-brief)?( true| false)? (\d+) (\d+) (.*)$/)) {
                    brief = m[1];
                    line = parseInt(m[3]);
                    col = parseInt(m[4]);
                    file = _this.resolveRelativePath(m[5]);
                    pos = _this.fileCache.lineColToPosition(file, line, col);
                    info = _this.ls.getCompletionsAtPosition(file, pos) || null;
                    if (info) {
                        // fill in completion entry details, unless briefness requested
                        !brief && (info.entries = info.entries.map(function (e) {
                            var d = _this.ls.getCompletionEntryDetails(file, pos, e.name);
                            if (d) {
                                d["type"] = ts.displayPartsToString(d.displayParts);
                                d["docComment"] = ts.displayPartsToString(d.documentation);
                                return d;
                            }
                            else {
                                return e;
                            }
                        }));
                        // NOTE: details null for primitive type symbols, see TS #1592
                        (function () {
                            var languageVersion = _this.compilerOptions.target;
                            var source = _this.fileCache.getScriptInfo(file).content;
                            var startPos = pos;
                            var idPart = function (p) { return /[0-9a-zA-Z_$]/.test(source[p])
                                || ts.isIdentifierPart(source.charCodeAt(p), languageVersion); };
                            var idStart = function (p) { return /[a-zA-Z_$]/.test(source[p])
                                || ts.isIdentifierStart(source.charCodeAt(p), languageVersion); };
                            while ((--startPos >= 0) && idPart(startPos))
                                ;
                            if ((++startPos < pos) && idStart(startPos)) {
                                var prefix = source.slice(startPos, pos);
                                info["prefix"] = prefix;
                                var len = prefix.length;
                                info.entries = info.entries.filter(function (e) { return e.name.substr(0, len) === prefix; });
                            }
                        })();
                    }
                    _this.output(info, ["displayParts", "documentation"]);
                }
                else if (m = match(cmd, /^update( nocheck)? (\d+)( (\d+)-(\d+))? (.*)$/)) {
                    file = _this.resolveRelativePath(m[6]);
                    script = _this.fileCache.getScriptInfo(file);
                    added = !script;
                    range = !!m[3];
                    check = !m[1];
                    // TODO: handle dependency changes
                    if (!added || !range) {
                        collecting = parseInt(m[2]);
                        on_collected_callback = function () {
                            if (!range) {
                                _this.fileCache.updateScript(file, lines.join(EOL));
                            }
                            else {
                                var startLine = parseInt(m[4]);
                                var endLine = parseInt(m[5]);
                                var maxLines = script.lineMap.length;
                                var startPos = startLine <= maxLines
                                    ? (startLine < 1 ? 0 : _this.fileCache.lineColToPosition(file, startLine, 1))
                                    : script.content.length;
                                var endPos = endLine < maxLines
                                    ? (endLine < 1 ? 0 : _this.fileCache.lineColToPosition(file, endLine + 1, 0) - 1) //??CHECK
                                    : script.content.length;
                                _this.fileCache.editScript(file, startPos, endPos, lines.join(EOL));
                            }
                            var syn, sem;
                            if (check) {
                                syn = _this.ls.getSyntacticDiagnostics(file).length;
                                sem = _this.ls.getSemanticDiagnostics(file).length;
                            }
                            on_collected_callback = undefined;
                            lines = [];
                            _this.outputJSON((added ? '"added ' : '"updated ')
                                + (range ? 'lines' + m[3] + ' in ' : '')
                                + file + (check ? ', (' + syn + '/' + sem + ') errors' : '') + '"');
                        };
                    }
                    else {
                        _this.outputJSON('"cannot update line range in new file"');
                    }
                }
                else if (m = match(cmd, /^showErrors$/)) {
                    info = _this.ls.getProgram().getGlobalDiagnostics()
                        .concat(_this.getErrors())
                        .map(function (d) {
                        var file = _this.resolveRelativePath(d.file.fileName);
                        var lc = _this.fileCache.positionToLineCol(file, d.start);
                        var len = _this.fileCache.getScriptInfo(file).content.length;
                        var end = Math.min(len, d.start + d.length);
                        // NOTE: clamped to end of file (#11)
                        var lc2 = _this.fileCache.positionToLineCol(file, end);
                        return {
                            file: file,
                            start: { line: lc.line, character: lc.character },
                            end: { line: lc2.line, character: lc2.character },
                            text: d.messageText,
                            code: d.code,
                            phase: d["phase"],
                            category: ts.DiagnosticCategory[d.category]
                        };
                    });
                    _this.output(info);
                }
                else if (m = match(cmd, /^files$/)) {
                    info = _this.lsHost.getScriptFileNames(); // TODO: files are pre-resolved
                    _this.output(info);
                }
                else if (m = match(cmd, /^lastError(Dump)?$/)) {
                    if (_this.lastError)
                        if (m[1])
                            console.log(JSON.parse(_this.lastError).stack);
                        else
                            _this.outputJSON(_this.lastError);
                    else
                        _this.outputJSON('"no last error"');
                }
                else if (m = match(cmd, /^dump (\S+) (.*)$/)) {
                    var dump = m[1];
                    file = _this.resolveRelativePath(m[2]);
                    source = _this.fileCache.getScriptInfo(file).content;
                    if (dump === "-") {
                        console.log('dumping ' + file);
                        console.log(source);
                    }
                    else {
                        ts.sys.writeFile(dump, source, false);
                        _this.outputJSON('"dumped ' + file + ' to ' + dump + '"');
                    }
                }
                else if (m = match(cmd, /^reload$/)) {
                    // TODO: keep updated (in-memory-only) files?
                    _this.setup(_this.rootFiles, _this.compilerOptions);
                    _this.outputJSON(_this.listeningMessage('reloaded'));
                }
                else if (m = match(cmd, /^quit$/)) {
                    rl.close();
                }
                else if (m = match(cmd, /^prettyJSON (true|false)$/)) {
                    _this.prettyJSON = m[1] === 'true';
                    _this.outputJSON('"pretty JSON: ' + _this.prettyJSON + '"');
                }
                else if (m = match(cmd, /^help$/)) {
                    console.log(Object.keys(commands).join(EOL));
                }
                else {
                    _this.outputJSON('"TSS command syntax error: ' + cmd + '"');
                }
            }
            catch (e) {
                _this.lastError = (JSON.stringify({ msg: e.toString(), stack: e.stack })).trim();
                _this.outputJSON('"TSS command processing error: ' + e + '"');
            }
        }).on('close', function () {
            _this.outputJSON('"TSS closing"');
        });
        this.outputJSON(this.listeningMessage('loaded'));
    };
    TSS.prototype.listeningMessage = function (prefix) {
        var count = this.rootFiles.length - 1;
        var more = count > 0 ? ' (+' + count + ' more)' : '';
        return '"' + prefix + ' ' + this.rootFiles[0] + more + ', TSS listening.."';
    };
    return TSS;
})();
// from src/compiler/tsc.ts - not yet exported from there:-(
function findConfigFile() {
    var searchPath = ts.normalizePath(ts.sys.getCurrentDirectory());
    var filename = "tsconfig.json";
    while (true) {
        if (ts.sys.fileExists(filename)) {
            return filename;
        }
        var parentPath = ts.getDirectoryPath(searchPath);
        if (parentPath === searchPath) {
            break;
        }
        searchPath = parentPath;
        filename = "../" + filename;
    }
    return undefined;
}
var fileNames;
var configFile, configObject, configObjectParsed;
// NOTE: partial options support only
var commandLine = ts.parseCommandLine(ts.sys.args);
if (commandLine.options.version) {
    console.log(require("../package.json").version);
    process.exit(0);
}
if (commandLine.fileNames.length > 0) {
    fileNames = commandLine.fileNames;
}
else if (commandLine.options.project) {
    configFile = ts.normalizePath(ts.combinePaths(commandLine.options.project, "tsconfig.json"));
}
else {
    configFile = findConfigFile();
}
var options;
if (configFile) {
    configObject = ts.readConfigFile(configFile);
    if (!configObject) {
        console.error("can't read tsconfig.json at", configFile);
        process.exit(1);
    }
    configObjectParsed = ts.parseConfigFile(configObject, ts.getDirectoryPath(configFile));
    if (configObjectParsed.errors.length > 0) {
        console.error(configObjectParsed.errors);
        process.exit(1);
    }
    fileNames = configObjectParsed.fileNames;
    options = ts.extend(commandLine.options, configObjectParsed.options);
}
else {
    options = ts.extend(commandLine.options, ts.getDefaultCompilerOptions());
}
if (!fileNames) {
    console.error("can't find project root");
    console.error("please specify root source file");
    console.error("  or --project directory (containing a tsconfig.json)");
    process.exit(1);
}
var tss = new TSS();
tss.setup(fileNames, options);
tss.listen();
