// Copyright (c) Claus Reinke. All rights reserved.
// Licensed under the Apache License, Version 2.0.
// See LICENSE.txt in the project root for complete license information.

///<reference path='typings/node/node.d.ts'/>
///<reference path='node_modules/typescript/bin/typescript.d.ts'/>

import ts = require("typescript");
import harness = require("./harness");
import path = require("path");

function resolvePath(rpath) {
  return switchToForwardSlashes(path.resolve(rpath));
}

function switchToForwardSlashes(path: string) {
    return path.replace(/\\/g, "/");
}

// some approximated subsets..
interface ReadlineHandlers {
  on(event: string, listener: (event:string)=>void) : ReadlineHandlers;
  close() : void;
}
interface Readline {
  createInterface(options:any) : ReadlineHandlers;
}

// bypass import, we don't want to drop out of the global module;
// use fixed readline (https://github.com/joyent/node/issues/3305),
// fixed version should be in nodejs from about v0.9.9/v0.8.19?
var readline:Readline = require("./readline");

var EOL = require("os").EOL;

/** holds list of fileNames, ScriptInfos and ScriptSnapshots for LS host */
class FileCache {
  public ls: ts.LanguageService;
  public fileNames: string[] = [];
  public snapshots:ts.Map<ts.IScriptSnapshot> = {};
  public fileNameToScript:ts.Map<harness.ScriptInfo> = {};

  public getFileNames() { return this.fileNames; }

  /**
   * @param fileName resolved name of possibly cached file
   */
  public getScriptInfo(fileName) {
    if (!this.fileNameToScript[fileName]) {
      this.fetchFile(fileName);
    }
    return this.fileNameToScript[fileName];
  }

  /**
   * @param fileName resolved name of possibly cached file
   */
  public getScriptSnapshot(fileName) {
    // console.log("getScriptSnapshot",fileName);
    if (!this.snapshots[fileName]) {
      this.fetchFile(fileName);
    }
    return this.snapshots[fileName];
  }

  /**
   * @param fileName resolved file name
   * @param text file contents
   * @param isDefaultLib should fileName be listed first?
   */
  public addFile(fileName,text,isDefaultLib=false) {
    if (isDefaultLib) {
      this.fileNames.push(fileName);
    } else {
      this.fileNames.unshift(fileName);
    }
    this.fileNameToScript[fileName] = new harness.ScriptInfo(fileName,text);
    this.snapshots[fileName]        = new harness.ScriptSnapshot(this.getScriptInfo(fileName));
  }

  /**
   * @param fileName resolved file name
   */
  public fetchFile(fileName) {
    // console.log("fetchFile:",fileName);
    if (ts.sys.fileExists(fileName)) {
      this.addFile(fileName,ts.sys.readFile(fileName));
    } else {
      // console.error ("tss: cannot fetch file: "+fileName);
    }
  }

  /**
   * @param fileName resolved name of cached file
   * @param line 1 based index
   * @param col 1 based index
   */
  public lineColToPosition(fileName: string, line: number, col: number): number {
      var script: harness.ScriptInfo = this.getScriptInfo(fileName);

      return ts.getPositionOfLineAndCharacter(this.ls.getSourceFile(fileName),line-1, col-1);
  }

  /**
   * @param fileName resolved name of cached file
   * @returns {line,character} 1 based indices
   */
  public positionToLineCol(fileName: string, position: number): ts.LineAndCharacter {
      var script: harness.ScriptInfo = this.getScriptInfo(fileName);

      var lineChar = ts.getLineAndCharacterOfPosition(this.ls.getSourceFile(fileName),position);

      return {line: lineChar.line+1, character: lineChar.character+1 };
  }

  /**
   * @param fileName resolved name of cached file
   * @param line 1 based index
   */
  public getLineText(fileName,line) {
    var source    = this.ls.getSourceFile(fileName);
    var lineStart = ts.getPositionOfLineAndCharacter(source,line-1,0)
    var lineEnd   = ts.getPositionOfLineAndCharacter(source,line,0)-1;
    var lineText  = source.text.substring(lineStart,lineEnd);
    return lineText;
  }

  /**
   * @param fileName resolved name of possibly cached file
   * @param content new file contents
   */
  public updateScript(fileName: string, content: string) {
      var script = this.getScriptInfo(fileName);
      if (script) {
        script.updateContent(content);
        this.snapshots[fileName] = new harness.ScriptSnapshot(script);
      } else {
        this.addFile(fileName,content);
      }
  }

  /**
   * @param fileName resolved name of cached file
   * @param minChar first char of edit range
   * @param limChar first char after edit range
   * @param newText new file contents
   */
  public editScript(fileName: string, minChar: number, limChar: number, newText: string) {
      var script = this.getScriptInfo(fileName);
      if (script) {
          script.editContent(minChar, limChar, newText);
          this.snapshots[fileName] = new harness.ScriptSnapshot(script);
          return;
      }
      throw new Error("No script with name '" + fileName + "'");
  }
}

/** TypeScript Services Server,
    an interactive commandline tool
    for getting info on .ts projects */
class TSS {
  public compilerOptions: ts.CompilerOptions;
  public compilerHost: ts.CompilerHost;
  public lsHost : ts.LanguageServiceHost;
  public ls : ts.LanguageService;
  public rootFiles : string[];
  public lastError;

  constructor (public prettyJSON: boolean = false) { } // NOTE: call setup

  private fileCache: FileCache;

  /** collect syntactic and semantic diagnostics for all project files */
  public getErrors(): ts.Diagnostic[] {

      var addPhase = phase => d => {d.phase = phase; return d};
      var errors = [];
      this.fileCache.getFileNames().map( file=>{
        var syntactic = this.ls.getSyntacticDiagnostics(file);
        var semantic = this.ls.getSemanticDiagnostics(file);
        // this.ls.languageService.getEmitOutput(file).diagnostics;
        errors = errors.concat(syntactic.map(addPhase("Syntax"))
                              ,semantic.map(addPhase("Semantics")));
      });
      return errors;

  }

  /** flatten messageChain into string|string[] */
  private messageChain(message:string|ts.DiagnosticMessageChain) {
    if (typeof message==="string") {
      return [message];
    } else {
      return [message.messageText].concat(message.next?this.messageChain(message.next):[]);
    }
  }

  /** load file and dependencies, prepare language service for queries */
  public setup(files,options) {
    this.fileCache = new FileCache();

    this.rootFiles = files.map(file=>resolvePath(file));

    this.compilerOptions = options;
    this.compilerHost    = ts.createCompilerHost(options);

    //TODO: diagnostics

    // prime fileCache with root files and defaultLib
    var seenNoDefaultLib = options.noLib;
    this.rootFiles.forEach(file=>{
      var source = this.compilerHost.getSourceFile(file,options.target);
      if (source) {
        seenNoDefaultLib = seenNoDefaultLib || source.hasNoDefaultLib;
        this.fileCache.addFile(file,source.text);
      } else {
        throw ("tss cannot find file: "+file);
      }
    });
    if (!seenNoDefaultLib) {
      var defaultLibFileName = this.compilerHost.getDefaultLibFileName(options);
      var source = this.compilerHost.getSourceFile(defaultLibFileName,options.target);
      this.fileCache.addFile(defaultLibFileName,source.text);
    }

    // Get a language service
    // internally builds programs from root files,
    // chases dependencies (references and imports), ...
    // (NOTE: files are processed on demand, loaded via lsHost, cached in fileCache)
    this.lsHost = {
        getCompilationSettings : ()=>this.compilerOptions,
        getScriptFileNames : ()=>this.fileCache.getFileNames(),
        getScriptVersion : (fileName: string)=>this.fileCache.getScriptInfo(fileName).version.toString(),
        getScriptIsOpen : (fileName: string)=>this.fileCache.getScriptInfo(fileName).isOpen,
        getScriptSnapshot : (fileName: string)=>this.fileCache.getScriptSnapshot(fileName),
        getCurrentDirectory : ()=>ts.sys.getCurrentDirectory(),
        getDefaultLibFileName :
          (options: ts.CompilerOptions)=>ts.getDefaultLibFileName(options),
        log : (message)=>undefined, // ??
        trace : (message)=>undefined, // ??
        error : (message)=>console.error(message) // ??
    };
    this.ls = ts.createLanguageService(this.lsHost,ts.createDocumentRegistry());
    this.fileCache.ls = this.ls;
  }

  /** output value/object as JSON, excluding irrelevant properties,
   *  with optional pretty-printing controlled by this.prettyJSON
   *  @param info thing to output
   *  @param excludes Array of property keys to exclude
   */
  private output(info,excludes=["displayParts"]) {
    var replacer = (k,v)=>excludes.indexOf(k)!==-1?undefined:v;
    if (info) {
      console.log(JSON.stringify(info,replacer,this.prettyJSON?" ":undefined).trim());
    } else {
      console.log(JSON.stringify(info,replacer));
    }
  }

  private outputJSON(json) {
    console.log(json.trim());
  }

  /** recursively prepare navigationBarItems for JSON output */
  private handleNavBarItem(file:string,item:ts.NavigationBarItem) {
    // TODO: under which circumstances can item.spans.length be other than 1?
    return { info: [item.kindModifiers,item.kind,item.text].filter(s=>s!=="").join(" ")
           , kindModifiers : item.kindModifiers
           , kind: item.kind
           , text: item.text
           , min: this.fileCache.positionToLineCol(file,item.spans[0].start)
           , lim: this.fileCache.positionToLineCol(file,item.spans[0].start+item.spans[0].length)
           , childItems: item.childItems.map(item=>this.handleNavBarItem(file,item))
           };
  }

  /** commandline server main routine: commands in, JSON info out */
  public listen() {
    var line: number;
    var col: number;

    var rl = readline.createInterface({input:process.stdin,output:process.stdout});

    var cmd:string, pos:number, file:string, script, added:boolean, range:boolean, check:boolean
      , def, refs:ts.ReferenceEntry[], locs:ts.DefinitionInfo[], info, source:ts.SourceFile
      , brief, member:boolean, navbarItems:ts.NavigationBarItem[], pattern:string;

    var collecting = 0, on_collected_callback:()=>void, lines:string[] = [];

    var commands = {};
    function match(cmd,regexp) {
      commands[regexp.source] = true;
      return cmd.match(regexp);
    }

    rl.on('line', input => {  // most commands are one-liners
      var m:string[];
      try {

        cmd = input.trim();

        if (collecting>0) { // multiline input, eg, source

          lines.push(input)
          collecting--;

          if (collecting===0) {
            on_collected_callback();
          }

        } else if (m = match(cmd,/^signature (\d+) (\d+) (.*)$/)) { // only within call parameters?

          (()=>{
            line   = parseInt(m[1]);
            col    = parseInt(m[2]);
            file   = resolvePath(m[3]);

            pos    = this.fileCache.lineColToPosition(file,line,col);

            info   = this.ls.getSignatureHelpItems(file,pos);

            var param = p=>({name:p.name
                            ,isOptional:p.isOptional
                            ,type:ts.displayPartsToString(p.displayParts)||""
                            ,docComment:ts.displayPartsToString(p.documentation)||""
                            });

            info && (info.items = info.items
                                      .map(item=>({prefix: ts.displayPartsToString(item.prefixDisplayParts)||""
                                                  ,separator: ts.displayPartsToString(item.separatorDisplayParts)||""
                                                  ,suffix: ts.displayPartsToString(item.suffixDisplayParts)||""
                                                  ,parameters: item.parameters.map(param)
                                                  ,docComment: ts.displayPartsToString(item.documentation)||""
                                                  }))
            );

            this.output(info);
          })();

        } else if (m = match(cmd,/^(type|quickInfo) (\d+) (\d+) (.*)$/)) { // "type" deprecated

          line   = parseInt(m[2]);
          col    = parseInt(m[3]);
          file   = resolvePath(m[4]);

          pos    = this.fileCache.lineColToPosition(file,line,col);

          info            = (this.ls.getQuickInfoAtPosition(file, pos)||{});
          info.type       = ((info&&ts.displayPartsToString(info.displayParts))||"");
          info.docComment = ((info&&ts.displayPartsToString(info.documentation))||"");

          this.output(info);

        } else if (m = match(cmd,/^definition (\d+) (\d+) (.*)$/)) {

          line = parseInt(m[1]);
          col  = parseInt(m[2]);
          file = resolvePath(m[3]);

          pos  = this.fileCache.lineColToPosition(file,line,col);
          locs = this.ls.getDefinitionAtPosition(file, pos); // NOTE: multiple definitions

          info = locs && locs.map( def => ({
            def  : def,
            file : def && def.fileName,
            min  : def && this.fileCache.positionToLineCol(def.fileName,def.textSpan.start),
            lim  : def && this.fileCache.positionToLineCol(def.fileName,ts.textSpanEnd(def.textSpan))
          }));

          // TODO: what about multiple definitions?
          this.output((locs && info[0])||null);

        } else if (m = match(cmd,/^(references|occurrences) (\d+) (\d+) (.*)$/)) {

          line = parseInt(m[2]);
          col  = parseInt(m[3]);
          file = resolvePath(m[4]);

          pos  = this.fileCache.lineColToPosition(file,line,col);
          switch (m[1]) {
            case "references":
              refs = this.ls.getReferencesAtPosition(file, pos);
              break;
            case "occurrences":
              refs = this.ls.getOccurrencesAtPosition(file, pos);
              break;
            default:
              throw "cannot happen";
          }

          info = (refs || []).map( ref => {
            var start, end, fileName, lineText;
            if (ref) {
              start    = this.fileCache.positionToLineCol(ref.fileName,ref.textSpan.start);
              end      = this.fileCache.positionToLineCol(ref.fileName,ts.textSpanEnd(ref.textSpan));
              fileName = resolvePath(ref.fileName);
              lineText = this.fileCache.getLineText(fileName,start.line);
            }
            return {
              ref      : ref,
              file     : ref && ref.fileName,
              lineText : lineText,
              min      : start,
              lim      : end
            }} );

          this.output(info);

        } else if (m = match(cmd,/^navigationBarItems (.*)$/)) {

          file = resolvePath(m[1]);

          this.output(this.ls.getNavigationBarItems(file)
                          .map(item=>this.handleNavBarItem(file,item)));

        } else if (m = match(cmd,/^navigateToItems (.*)$/)) {

          pattern = m[1];

          info = this.ls.getNavigateToItems(pattern)
                   .map(item=>{
                      item['min'] = this.fileCache.positionToLineCol(item.fileName
                                                                    ,item.textSpan.start);
                      item['lim'] = this.fileCache.positionToLineCol(item.fileName
                                                                    ,item.textSpan.start
                                                                    +item.textSpan.length);
                      return item;
                    });

          this.output(info);

        } else if (m = match(cmd,/^completions(-brief)?( true| false)? (\d+) (\d+) (.*)$/)) {

          brief  = m[1];
          line   = parseInt(m[3]);
          col    = parseInt(m[4]);
          file   = resolvePath(m[5]);

          pos    = this.fileCache.lineColToPosition(file,line,col);

          info = this.ls.getCompletionsAtPosition(file, pos) || null;

          if (info) {
            // fill in completion entry details, unless briefness requested
            !brief && (info.entries = info.entries.map( e =>{
                        var d = this.ls.getCompletionEntryDetails(file,pos,e.name);
                        if (d) {
                          d["type"]      =ts.displayPartsToString(d.displayParts);
                          d["docComment"]=ts.displayPartsToString(d.documentation);
                          return d;
                        } else {
                          return e;
                        }} ));
                        // NOTE: details null for primitive type symbols, see TS #1592

            (()=>{ // filter entries by prefix, determined by pos
              var languageVersion = this.compilerOptions.target;
              var source   = this.fileCache.getScriptInfo(file).content;
              var startPos = pos;
              var idPart   = p => /[0-9a-zA-Z_$]/.test(source[p])
                               || ts.isIdentifierPart(source.charCodeAt(p),languageVersion);
              var idStart  = p => /[a-zA-Z_$]/.test(source[p])
                               || ts.isIdentifierStart(source.charCodeAt(p),languageVersion);
              while ((--startPos>=0) && idPart(startPos) );
              if ((++startPos < pos) && idStart(startPos)) {
                var prefix = source.slice(startPos,pos);
                info["prefix"] = prefix;
                var len    = prefix.length;
                info.entries = info.entries.filter( e => e.name.substr(0,len)===prefix );
              }
            })();
          }

          this.output(info,["displayParts","documentation","sortText"]);

        } else if (m = match(cmd,/^update( nocheck)? (\d+)( (\d+)-(\d+))? (.*)$/)) { // send non-saved source

          file       = resolvePath(m[6]);
          source     = this.ls.getSourceFile(file);
          script     = this.fileCache.getScriptInfo(file);
          added      = !script;
          range      = !!m[3]
          check      = !m[1]

          if (!added || !range) {
            collecting = parseInt(m[2]);
            on_collected_callback = () => {

              if (!range) {
                this.fileCache.updateScript(file,lines.join(EOL));
              } else {
                var startLine = parseInt(m[4]);
                var endLine   = parseInt(m[5]);
                var maxLines  = source.getLineStarts().length;
                var startPos  = startLine<=maxLines
                              ? (startLine<1 ? 0 : this.fileCache.lineColToPosition(file,startLine,1))
                              : script.content.length;
                var endPos    = endLine<maxLines
                              ? (endLine<1 ? 0 : this.fileCache.lineColToPosition(file,endLine+1,0)-1) //??CHECK
                              : script.content.length;

                this.fileCache.editScript(file, startPos, endPos, lines.join(EOL));
              }
              var syn:number,sem:number;
              if (check) {
                syn = this.ls.getSyntacticDiagnostics(file).length;
                sem = this.ls.getSemanticDiagnostics(file).length;
              }
              on_collected_callback = undefined;
              lines = [];

              this.outputJSON((added ? '"added ' : '"updated ')
                              +(range ? 'lines'+m[3]+' in ' : '')
                              +file+(check ? ', ('+syn+'/'+sem+') errors' : '')+'"');
            };
          } else {
            this.outputJSON('"cannot update line range in new file"');
          }

        } else if (m = match(cmd,/^showErrors$/)) { // get processing errors

          info = this.ls.getProgram().getGlobalDiagnostics()
                     .concat(this.getErrors())
                     .map( d => {
                           if (d.file) {

                             var file = resolvePath(d.file.fileName);
                             var lc   = this.fileCache.positionToLineCol(file,d.start);
                             var len  = this.fileCache.getScriptInfo(file).content.length;
                             var end  = Math.min(len,d.start+d.length);
                                        // NOTE: clamped to end of file (#11)
                             var lc2  = this.fileCache.positionToLineCol(file,end);
                             return {
                              file: file,
                              start: {line: lc.line, character: lc.character},
                              end: {line: lc2.line, character: lc2.character},
                              text: this.messageChain(d.messageText).join(EOL),
                              code: d.code,
                              phase: d["phase"],
                              category: ts.DiagnosticCategory[d.category]
                             };

                           } else { // global diagnostics have no file

                             return {
                              text: this.messageChain(d.messageText).join(EOL),
                              code: d.code,
                              phase: d["phase"],
                              category: ts.DiagnosticCategory[d.category]
                             };

                           }
                         }
                       );

          this.output(info);

        } else if (m = match(cmd,/^files$/)) { // list files in project

          info = this.lsHost.getScriptFileNames(); // TODO: files are pre-resolved

          this.output(info);

        } else if (m = match(cmd,/^lastError(Dump)?$/)) { // debugging only

          if (this.lastError)
            if (m[1]) // commandline use
              console.log(JSON.parse(this.lastError).stack);
            else
              this.outputJSON(this.lastError);
          else
            this.outputJSON('"no last error"');

        } else if (m = match(cmd,/^dump (\S+) (.*)$/)) { // debugging only

          (()=>{
            var dump = m[1];
            var file = resolvePath(m[2]);

            var sourceText = this.fileCache.getScriptInfo(file).content;
            if (dump==="-") { // to console
              console.log('dumping '+file);
              console.log(sourceText);
            } else { // to file
              ts.sys.writeFile(dump,sourceText,false);

              this.outputJSON('"dumped '+file+' to '+dump+'"');
            }
          })();

        } else if (m = match(cmd,/^reload$/)) { // reload current project

          // TODO: keep updated (in-memory-only) files?
          this.setup(this.rootFiles,this.compilerOptions);
          this.outputJSON(this.listeningMessage('reloaded'));

        } else if (m = match(cmd,/^quit$/)) {

          rl.close();

        } else if (m = match(cmd,/^prettyJSON (true|false)$/)) { // useful for debugging

          this.prettyJSON = m[1]==='true';

          this.outputJSON('"pretty JSON: '+this.prettyJSON+'"');

        } else if (m = match(cmd,/^help$/)) {

          console.log(Object.keys(commands).join(EOL));

        } else {

          this.outputJSON('"TSS command syntax error: '+cmd+'"');

        }

      } catch(e) {

          this.lastError = (JSON.stringify({msg:e.toString(),stack:e.stack})).trim();
          this.outputJSON('"TSS command processing error: '+e+'"');

      }

    }).on('close', () => {

          this.outputJSON('"TSS closing"');

    });

    this.outputJSON(this.listeningMessage('loaded'));

  }

  private listeningMessage(prefix) {
    var count = this.rootFiles.length-1;
    var more  = count>0 ? ' (+'+count+' more)' : '';
    return '"'+prefix+' '+this.rootFiles[0]+more+', TSS listening.."';
  }
}

function extend(o1,o2) {
  var o = {};
  for(var p in o1) { o[p] = o1[p] }
  for(var p in o2) { if(!(p in o)) o[p] = o2[p] }
  return o;
}

var fileNames;
var configFile, configObject, configObjectParsed;

// NOTE: partial options support only
var commandLine = ts.parseCommandLine(ts.sys.args);

if (commandLine.options.version) {
  console.log(require("../package.json").version);
  process.exit(0);
}

if (commandLine.fileNames.length>0) {

  fileNames = commandLine.fileNames;

} else if (commandLine.options.project) {

  configFile = path.join(commandLine.options.project,"tsconfig.json");

} else {

  configFile = ts.findConfigFile(path.normalize(ts.sys.getCurrentDirectory()));

}

var options;

if (configFile) {

  configObject = ts.readConfigFile(configFile);

  if (!configObject) {
    console.error("can't read tsconfig.json at",configFile);
    process.exit(1);
  }

  configObjectParsed = ts.parseConfigFile(configObject,path.dirname(configFile));

  if (configObjectParsed.errors.length>0) {
    console.error(configObjectParsed.errors);
    process.exit(1);
  }

  fileNames = configObjectParsed.fileNames;
  options   = extend(commandLine.options,configObjectParsed.options);

} else {

  options = extend(commandLine.options,ts.getDefaultCompilerOptions());

}

if (!fileNames) {
  console.error("can't find project root");
  console.error("please specify root source file");
  console.error("  or --project directory (containing a tsconfig.json)");
  process.exit(1);
}

var tss = new TSS();
try {
  tss.setup(fileNames,options);
  tss.listen();
} catch (e) {
  console.error(e.toString());
  process.exit(1);
}
