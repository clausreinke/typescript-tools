// Copyright (c) Microsoft, Claus Reinke. All rights reserved.
// Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='./harness.ts'/>
///<reference path='./resolver.ts'/>
///<reference path='../typescript/src/harness/external/json2.ts'/>

// TODO: get rid of hardcoded path references..
var libdts  = "../typescript/typings/lib.d.ts";

// TS has its own declarations for node-specific stuff, so we
// need to extend those instead of referencing node.d.ts
declare module process {
  export var stdin : any;
}

// some approximated subsets..
interface ReadlineHandlers {
  on(event: string, listener: (event:string)=>void) : ReadlineHandlers;
  close() : void;
}
interface Readline {
  createInterface(options:any) : ReadlineHandlers;
}

// bypass import, we don't want to drop out of the global module
var readline:Readline = require("readline");

// TypeScript Services Server,
// an interactive commandline tool
// for getting info on .ts projects
class TSS {
  public compilationSettings: TypeScript.CompilationSettings;
  public compilationEnvironment: TypeScript.CompilationEnvironment;
  public commandLineHost = new CommandLineHost();
  public ls : Services.ILanguageService;
  public refcode : TypeScript.SourceUnit;

  constructor (public ioHost: IIO) { } // NOTE: call setup

  // convert character position to line/column
  private charToLine(lineMap,ch) {
    var i=1;
    while ((i+1<lineMap.length)&&(lineMap[i+1]<ch)) { i++; }
    return [i,ch-lineMap[i]+1];
  }

  // load file and dependencies, prepare language service for queries
  public setup(file) {
    this.compilationSettings    = new TypeScript.CompilationSettings();
    this.compilationEnvironment = new TypeScript.CompilationEnvironment(this.compilationSettings, this.ioHost);

    var useDefaultLib: bool = true;
    /*
    TypeScript.CompilerDiagnostics.debug = true;
    TypeScript.CompilerDiagnostics.diagnosticWriter = 
      { Alert: (s: string) => { this.ioHost.printLine(s); } };
    */

    var typescriptLS = new Harness.TypeScriptLS();

    if (useDefaultLib) {
      var libText = IO.readFile(libdts);
      this.compilationEnvironment.code.push(
        new TypeScript.SourceUnit(libdts,null)
      );
    }

    // add project root
    this.compilationEnvironment.code.push(
      new TypeScript.SourceUnit(file,null)
    );

    // chase dependencies (references and imports)
    this.compilationEnvironment = this.commandLineHost.resolve(this.compilationEnvironment);

    // copy compilation code units to languageService code units
    this.compilationEnvironment.code.forEach( (code,i) => {
      // this.ioHost.printLine(i+': '+code.path);
      typescriptLS.addScript(code.path,code.content,true);
    });

    // Get the language service
    this.ls = typescriptLS.getLanguageService();

    // remember the code unit for the project root (compilationEnvironment
    // doesn't seem to support lookup by short name, or short to full path
    // resolution); code unit for path argument is last (after dependencies)
    // TODO: find unit from path argument
    this.refcode = this.compilationEnvironment
                       .code[this.compilationEnvironment.code.length-1];

  }

  public listen() {
    var line: number;
    var col: number;

    var refcode   = this.refcode;
    var refname   = refcode.path;

    var rl = readline.createInterface({input:process.stdin,output:process.stdout});

    var script, lineMap, pos, file, def, defFile, defLineMap, info, source, afterDot;

    rl.on('line', cmd => {
      var m;
      try {

        cmd = cmd.trim();

        if (m = cmd.match(/^(symbol|type) (\d+) (\d+) (.*)$/)) {

          line   = parseInt(m[2]);
          col    = parseInt(m[3]);
          file   = m[4];

          script  = this.ls.getScriptAST(file);
          lineMap = script.locationInfo.lineMap;
          pos     = lineMap[line] + (col - 1);

          if (m[1]==='symbol') {
            info = (this.ls.getSymbolAtPosition(script,pos)||"").toString();
          } else {
            info = (this.ls.getTypeAtPosition(file, pos).memberName||"").toString();
          }

          this.ioHost.printLine(JSON2.stringify(info).trim());

        } else if (m = cmd.match(/^definition (\d+) (\d+) (.*)$/)) {

          line   = parseInt(m[1]);
          col    = parseInt(m[2]);
          file   = m[3];

          script  = this.ls.getScriptAST(file);
          lineMap = script.locationInfo.lineMap;
          pos     = lineMap[line] + (col - 1);

          def  = this.ls.getDefinitionAtPosition(file, pos);
          if (def) {

            defFile    = this.compilationEnvironment.code[def.unitIndex].path,
            defLineMap = this.ls.getScriptAST(defFile).locationInfo.lineMap;

          } else {

            defFile = null;

          }

          info = {
            def  : def,
            file : defFile,
            min  : def && this.charToLine(defLineMap,def.minChar),
            lim  : def && this.charToLine(defLineMap,def.limChar)
          };

          this.ioHost.printLine(JSON2.stringify(info).trim());

        } else if (m = cmd.match(/^info (\d+) (\d+) (.*)$/)) {

          line = parseInt(m[1]);
          col  = parseInt(m[2]);
          file = m[3];

          script  = this.ls.getScriptAST(file);
          lineMap = script.locationInfo.lineMap;
          pos     = lineMap[line] + (col - 1);

          def  = this.ls.getDefinitionAtPosition(file, pos);
          if (def) {

            defFile    = this.compilationEnvironment.code[def.unitIndex].path,
            defLineMap = this.ls.getScriptAST(defFile).locationInfo.lineMap;

          } else {

            defFile = null;

          }

          // TODO: how to get that source back out?
          // source = this.ls.compilerState.getSourceText2(file); // ??
          // source[pos-1]==='.'; // do I have this right?
          afterDot = true;

          info = { // all together now..
            pos         : pos,
            linecol     : this.charToLine(lineMap,pos),

            symbol      : (this.ls.getSymbolAtPosition(script,pos)||"").toString(),
            type        : (this.ls.getTypeAtPosition(file, pos).memberName||"").toString(),

            def         : def,
            file        : defFile,
            min         : def && this.charToLine(defLineMap,def.minChar),
            lim         : def && this.charToLine(defLineMap,def.limChar),

            // signature: this.ls.getSignatureAtPosition(file, pos), // ??

            completions : this.ls.getCompletionsAtPosition(file, pos, afterDot),
                          // TODO: non-member completions??
          };

          this.ioHost.printLine(JSON2.stringify(info).trim());

        } else if (m = cmd.match(/^quit$/)) {

          rl.close();

        } else {

          this.ioHost.printLine('TSS command syntax error: '+cmd);

        }

      } catch(e) {

          this.ioHost.printLine('TSS command processing error: '+e);

      }

    }).on('close', () => {

          this.ioHost.printLine('TSS closing');

    });

    this.ioHost.printLine('loaded '+refname+', TSS listening..');

  }
}

var tss = new TSS(IO);
tss.setup(IO.arguments[0]);
tss.listen();
