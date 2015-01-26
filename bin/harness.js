// Copyright (c) Microsoft, Claus Reinke. All rights reserved.
// Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.
///<reference path='typings/node/node.d.ts'/>
///<reference path='node_modules/typescript/bin/typescript.d.ts'/>
///<reference path='node_modules/typescript/bin/typescript_internal.d.ts'/>
var ts = require("typescript");
/*
declare module process {
    export function nextTick(callback: () => any): void;
    export function on(event: string, listener: Function): any;
}
*/
// module Harness {
// Settings 
exports.userSpecifiedroot = "";
var global = Function("return this").call(null);
/** Splits the given string on \r\n or on only \n if that fails */
function splitContentByNewlines(content) {
    // Split up the input file by line
    // Note: IE JS engine incorrectly handles consecutive delimiters here when using RegExp split, so
    // we have to string-based splitting instead and try to figure out the delimiting chars
    var lines = content.split('\r\n');
    if (lines.length === 1) {
        lines = content.split('\n');
    }
    return lines;
}
exports.splitContentByNewlines = splitContentByNewlines;
var ScriptInfo = (function () {
    function ScriptInfo(fileName, content, isOpen) {
        if (isOpen === void 0) { isOpen = true; }
        this.fileName = fileName;
        this.content = content;
        this.isOpen = isOpen;
        this.version = 1;
        this.editRanges = [];
        this.lineMap = null;
        this.setContent(content);
    }
    ScriptInfo.prototype.setContent = function (content) {
        this.content = content;
        this.lineMap = ts.computeLineStarts(content);
    };
    ScriptInfo.prototype.updateContent = function (content) {
        var old_length = this.content.length;
        this.setContent(content);
        this.editRanges.push({
            length: content.length,
            textChangeRange: ts.createTextChangeRange(ts.createTextSpan(0, old_length), content.length)
        });
        this.version++;
    };
    ScriptInfo.prototype.editContent = function (minChar, limChar, newText) {
        // Apply edits
        var prefix = this.content.substring(0, minChar);
        var middle = newText;
        var suffix = this.content.substring(limChar);
        this.setContent(prefix + middle + suffix);
        // Store edit range + new length of script
        this.editRanges.push({
            length: this.content.length,
            textChangeRange: ts.createTextChangeRange(ts.createTextSpanFromBounds(minChar, limChar), newText.length)
        });
        // Update version #
        this.version++;
    };
    ScriptInfo.prototype.getTextChangeRangeBetweenVersions = function (startVersion, endVersion) {
        if (startVersion === endVersion) {
            // No edits!
            return ts.unchangedTextChangeRange;
        }
        var initialEditRangeIndex = this.editRanges.length - (this.version - startVersion);
        var lastEditRangeIndex = this.editRanges.length - (this.version - endVersion);
        var entries = this.editRanges.slice(initialEditRangeIndex, lastEditRangeIndex);
        return ts.collapseTextChangeRangesAcrossMultipleVersions(entries.map(function (e) { return e.textChangeRange; }));
    };
    return ScriptInfo;
})();
exports.ScriptInfo = ScriptInfo;
var ScriptSnapshot = (function () {
    function ScriptSnapshot(scriptInfo) {
        this.scriptInfo = scriptInfo;
        this.lineMap = null;
        this.textSnapshot = scriptInfo.content;
        this.version = scriptInfo.version;
    }
    ScriptSnapshot.prototype.getText = function (start, end) {
        return this.textSnapshot.substring(start, end);
    };
    ScriptSnapshot.prototype.getLength = function () {
        return this.textSnapshot.length;
    };
    ScriptSnapshot.prototype.getLineStartPositions = function () {
        if (this.lineMap === null) {
            this.lineMap = ts.computeLineStarts(this.textSnapshot);
        }
        return this.lineMap;
    };
    /*
            public getChangeRange(oldScript: ts.ScriptSnapshotShim): ts.TextChangeRange {
                var oldShim = <ScriptSnapshotShim>oldScript;
                var range = this.scriptInfo.getTextChangeRangeBetweenVersions(oldShim.version, this.version);
                if (range === null) {
                    return null;
                }
    
                return { span: { start: range.span.start, length: range.span.length }, newLength: range.newLength };
            }
    */
    ScriptSnapshot.prototype.getChangeRange = function (oldSnapshot) {
        return undefined;
    };
    return ScriptSnapshot;
})();
exports.ScriptSnapshot = ScriptSnapshot;
var CancellationToken = (function () {
    function CancellationToken(cancellationToken) {
        this.cancellationToken = cancellationToken;
    }
    CancellationToken.prototype.isCancellationRequested = function () {
        return this.cancellationToken && this.cancellationToken.isCancellationRequested();
    };
    CancellationToken.None = new CancellationToken(null);
    return CancellationToken;
})();
//    export class TypeScriptLSHost implements ts.LanguageServiceHost {
////        private ls: ts.ILanguageServiceShim = null;
//
//        private fileNameToScript: ts.Map<ScriptInfo>= {};
//
//        constructor(private cancellationToken: ts.CancellationToken = CancellationToken.None) {
//        }
//
//        public addDefaultLibrary() {
//            throw("addDefaultLibrary not implemented");
//            this.addScript("lib.d.ts", null);
//        }
//
//        public addFile(fileName: string) {
//            var code = ts.sys.readFile(fileName);
//            this.addScript(fileName, code);
//        }
//
//        public getScriptInfo(fileName: string): ScriptInfo { // originally private
//            return this.fileNameToScript[fileName];
//        }
//
//        public addScript(fileName: string, content: string) {
//            this.fileNameToScript[fileName] = new ScriptInfo(fileName, content);
//        }
//
//        public updateScript(fileName: string, content: string) {
//            var script = this.getScriptInfo(fileName);
//            if (script !== null) {
//                script.updateContent(content);
//                return;
//            }
//
//            this.addScript(fileName, content);
//        }
//
//        public editScript(fileName: string, minChar: number, limChar: number, newText: string) {
//            var script = this.getScriptInfo(fileName);
//            if (script !== null) {
//                script.editContent(minChar, limChar, newText);
//                return;
//            }
//
//            throw new Error("No script with name '" + fileName + "'");
//        }
//
//        //////////////////////////////////////////////////////////////////////
//        // ILogger implementation
//        //
//        public information(): boolean { return false; }
//        public debug(): boolean { return true; }
//        public warning(): boolean { return true; }
//        public error(): boolean { return true; }
//        public fatal(): boolean { return true; }
//
//        public log(s: string): void {
//            //console.log("TypeScriptLSHost:" + s);
//        }
//
//        // collect Diagnostics
//        /* TODO: reinstate
//        public getErrors(): ts.Diagnostic[] {
//
//            var addPhase = phase => d => {d.phase = phase; return d};
//            var errors = [];
//            this.ls.refresh(false);
//            ts.forEachKey(this.fileNameToScript, file=>{
//              var syntactic = this.ls.languageService.getSyntacticDiagnostics(file);
//              var semantic = this.ls.languageService.getSemanticDiagnostics(file);
//              // this.ls.languageService.getEmitOutput(file).diagnostics);
//              errors = errors.concat(syntactic.map(addPhase("Syntax"))
//                                    ,semantic.map(addPhase("Semantics")));
//            });
//            return errors;
//
//        }
//        */
//
//        //////////////////////////////////////////////////////////////////////
//        // ILanguageServiceShimHost implementation
//        //
//
//        public getCompilationSettings() : ts.CompilerOptions {
//            return ts.getDefaultCompilerOptions();
//        }
//
//        public getCancellationToken(): ts.CancellationToken {
//            return this.cancellationToken;
//        }
//
//        public getCurrentDirectory(): string {
//            return "";
//        }
//
//        public getDefaultLibFilename(): string {
//            return "";
//        }
//
//        public getScriptFileNames(): string[] {
//            var fileNames: string[] = [];
//            ts.forEachKey(this.fileNameToScript, (fileName) => { fileNames.push(fileName); });
//            return fileNames;
//        }
//
//        public getScriptSnapshot(fileName: string): ts.IScriptSnapshot {
//            return new ScriptSnapshot(this.getScriptInfo(fileName));
//        }
//
//        public getScriptVersion(fileName: string): string {
//            return this.getScriptInfo(fileName).version.toString();
//        }
//
//        public getScriptIsOpen(fileName: string): boolean {
//            return this.getScriptInfo(fileName).isOpen;
//        }
//
////        public getScriptByteOrderMark(fileName: string): ts.ByteOrderMark {
////            return this.getScriptInfo(fileName).byteOrderMark;
////        }
//
////        public getDiagnosticsObject(): ts.Services.ILanguageServicesDiagnostics {
////            return new LanguageServicesDiagnostics("");
////        }
//
//        public getLocalizedDiagnosticMessages(): string {
//            return "";
//        }
//
//        public fileExists(s: string) {
//            return ts.sys.fileExists(s);
//        }
//
//        public directoryExists(s: string) {
//            return ts.sys.directoryExists(s);
//        }
//
///*
//        public resolveRelativePath(path: string, directory: string): string {
//            if (ts.isRooted(path) || !directory) {
//                return ts.sys.absolutePath(path);
//            }
//            else {
//                return ts.sys.absolutePath(ts.IOUtils.combine(directory, path));
//            }
//        }
//
//        public getParentDirectory(path: string): string {
//            return ts.sys.directoryName(path);
//        }
//*/
//
//        /** Return a new instance of the language service shim, up-to-date wrt to typecheck.
//         *  To access the non-shim (i.e. actual) language service, use the "ls.languageService" property.
//         */
////        public getLanguageService(): ts.Services.ILanguageServiceShim {
////            var ls = new ts.Services.TypeScriptServicesFactory().createLanguageServiceShim(this);
////            ls.refresh(true);
////            this.ls = ls;
////            return ls;
////        }
//
//        /** Parse file given its source text */
//        public parseSourceText(fileName: string, sourceText: ts.IScriptSnapshot): ts.SourceFile {
//            var result = ts.createSourceFile(fileName, sourceText.getText(0, sourceText.getLength()), ts.ScriptTarget.Latest);
//            return result;
//        }
//
//        /** Parse a file on disk given its fileName */
//        public parseFile(fileName: string) {
//            var sourceText = ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName))
//            return this.parseSourceText(fileName, sourceText);
//        }
//
//        /**
//         * @param line 1 based index
//         * @param col 1 based index
//        */
//        public lineColToPosition(fileName: string, line: number, col: number): number {
//            var script: ScriptInfo = this.fileNameToScript[fileName];
//
//            return ts.getPositionFromLineAndCharacter(script.lineMap,line - 1, col - 1);
//        }
//
//        /**
//         * @param line 1 based index
//         * @param col 1 based index
//        */
//        public positionToLineCol(fileName: string, position: number): ts.LineAndCharacter {
//            var script: ScriptInfo = this.fileNameToScript[fileName];
//
//            var result = ts.getLineAndCharacterOfPosition(script.lineMap,position);
//
//            return { line: result.line+1, character: result.character+1 };
//        }
//
//        /**
//         * @param line 0 based index
//         * @param col 0 based index
//        */
//        public positionToZeroBasedLineCol(fileName: string, position: number): ts.LineAndCharacter {
//            var script: ScriptInfo = this.fileNameToScript[fileName];
//
//            var result = ts.getLineAndCharacterOfPosition(script.lineMap,position);
//
//            return { line: result.line, character: result.character };
//        }
//
//        /** Verify that applying edits to sourceFileName result in the content of the file baselineFileName */
//        public checkEdits(sourceFileName: string, baselineFileName: string, edits: ts.TextChange[]) {
//            var script = ts.sys.readFile(sourceFileName);
//            var formattedScript = this.applyEdits(script, edits);
//            var baseline = ts.sys.readFile(baselineFileName);
//
//            function noDiff(text1: string, text2: string) {
//                text1 = text1.replace(/^\s+|\s+$/g, "").replace(/\r\n?/g, "\n");
//                text2 = text2.replace(/^\s+|\s+$/g, "").replace(/\r\n?/g, "\n");
//
//                if (text1 !== text2) {
//                    var errorString = "";
//                    var text1Lines = text1.split(/\n/);
//                    var text2Lines = text2.split(/\n/);
//                    for (var i = 0; i < text1Lines.length; i++) {
//                        if (text1Lines[i] !== text2Lines[i]) {
//                            errorString += "Difference at line " + (i + 1) + ":\n";
//                            errorString += "                  Left File: " + text1Lines[i] + "\n";
//                            errorString += "                 Right File: " + text2Lines[i] + "\n\n";
//                        }
//                    }
//                    throw (new Error(errorString));
//                }
//            }
////            assert.isTrue(noDiff(formattedScript, baseline));
////            assert.equal(formattedScript, baseline);
//        }
//
//
//        /** Apply an array of text edits to a string, and return the resulting string. */
//        public applyEdits(content: string, edits: ts.TextChange[]): string {
//            var result = content;
//            edits = this.normalizeEdits(edits);
//
//            for (var i = edits.length - 1; i >= 0; i--) {
//                var edit = edits[i];
//                var prefix = result.substring(0, edit.span.start);
//                var middle = edit.newText;
//                var suffix = result.substring(ts.textSpanEnd(edit.span));
//                result = prefix + middle + suffix;
//            }
//            return result;
//        }
//
//        /** Normalize an array of edits by removing overlapping entries and sorting entries on the minChar position. */
//        private normalizeEdits(edits: ts.TextChange[]): ts.TextChange[] {
//            var result: ts.TextChange[] = [];
//
//            function mapEdits(edits: ts.TextChange[]): { edit: ts.TextChange; index: number; }[] {
//                var result: { edit: ts.TextChange; index: number; }[] = [];
//                for (var i = 0; i < edits.length; i++) {
//                    result.push({ edit: edits[i], index: i });
//                }
//                return result;
//            }
//
//            var temp = mapEdits(edits).sort(function (a, b) {
//                var result = a.edit.span.start - b.edit.span.start;
//                if (result === 0)
//                    result = a.index - b.index;
//                return result;
//            });
//
//            var current = 0;
//            var next = 1;
//            while (current < temp.length) {
//                var currentEdit = temp[current].edit;
//
//                // Last edit
//                if (next >= temp.length) {
//                    result.push(currentEdit);
//                    current++;
//                    continue;
//                }
//                var nextEdit = temp[next].edit;
//
//                var gap = nextEdit.span.start - ts.textSpanEnd(currentEdit.span);
//
//                // non-overlapping edits
//                if (gap >= 0) {
//                    result.push(currentEdit);
//                    current = next;
//                    next++;
//                    continue;
//                }
// 
//                // overlapping edits: for now, we only support ignoring an next edit 
//                // entirely contained in the current edit.
//                if (ts.textSpanEnd(currentEdit.span) >= ts.textSpanEnd(nextEdit.span)) {
//                    next++;
//                    continue;
//                }
//                else {
//                    throw new Error("Trying to apply overlapping edits");
//                }
//            }
//
//            return result;
//        }
//  }
/*
    export class LanguageServicesDiagnostics implements ts.Services.ILanguageServicesDiagnostics {

        constructor(private destination: string) { }

        public log(content: string): void {
            ts.sys.standardError.WriteLine(content);
            //Imitates the LanguageServicesDiagnostics object when not in Visual Studio
        }

    }
*/
// }
