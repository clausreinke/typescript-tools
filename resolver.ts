// Copyright (c) Microsoft, Claus Reinke. All rights reserved.
// Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

// from tsc.ts, with resolve adapted from BatchCompiler
class CommandLineHost implements TypeScript.IResolverHost {

    public pathMap: any = {};
    public resolvedPaths: any = {};

    public isResolved(path: string) {
        return this.resolvedPaths[this.pathMap[path]] != undefined;
    }

    public resolveCompilationEnvironment(preEnv: TypeScript.CompilationEnvironment,
        resolver: TypeScript.ICodeResolver,
        traceDependencies: bool): TypeScript.CompilationEnvironment {
        var resolvedEnv = new TypeScript.CompilationEnvironment(preEnv.compilationSettings
                                                               ,preEnv.ioHost);

        var nCode = preEnv.code.length;
        var nRCode = preEnv.residentCode.length;

        var postResolutionError = 
            (errorFile: string, line: number, col: number, errorMessage: string) => {
                TypeScript.CompilerDiagnostics
                          .debugPrint("Could not resolve file '" + errorFile + "'"
                                      + " (" + line + "/" + col +")"
                                      + (errorMessage == "" ? "" : ": " + errorMessage));
            }

        var resolutionDispatcher: TypeScript.IResolutionDispatcher = {
            postResolutionError: postResolutionError,
            postResolution: (path: string, code: TypeScript.ISourceText) => {
                if (!this.resolvedPaths[path]) {
                    resolvedEnv.code.push(<TypeScript.SourceUnit>code);
                    this.resolvedPaths[path] = true;
                }
            }
        };

        var residentResolutionDispatcher: TypeScript.IResolutionDispatcher = {
            postResolutionError: postResolutionError,
            postResolution: (path: string, code: TypeScript.ISourceText) => {
                if (!this.resolvedPaths[path]) {
                    resolvedEnv.residentCode.push(<TypeScript.SourceUnit>code);
                    this.resolvedPaths[path] = true;
                }
            }
        };
        var path = "";

        for (var i = 0; i < nRCode; i++) {
            path = TypeScript.switchToForwardSlashes(preEnv.ioHost.resolvePath(preEnv.residentCode[i].path));
            this.pathMap[preEnv.residentCode[i].path] = path;
            resolver.resolveCode(path, "", false, residentResolutionDispatcher);
        }

        for (var i = 0; i < nCode; i++) {
            path = TypeScript.switchToForwardSlashes(preEnv.ioHost.resolvePath(preEnv.code[i].path));
            this.pathMap[preEnv.code[i].path] = path;
            resolver.resolveCode(path, "", false, resolutionDispatcher);
        }

        return resolvedEnv;
    }

    public resolve(compilationEnvironment) { // from tsc.ts BatchCompiler
      var resolver = new TypeScript.CodeResolver(compilationEnvironment);
      var ret = this.resolveCompilationEnvironment(compilationEnvironment, resolver, true);

      for (var i = 0; i < compilationEnvironment.residentCode.length; i++) {
        if (!this.isResolved(compilationEnvironment.residentCode[i].path)) {
          var path = compilationEnvironment.residentCode[i].path;
          if (!TypeScript.isSTRFile(path) && !TypeScript.isDSTRFile(path)) {
            compilationEnvironment.ioHost.stderr.WriteLine("Unknown extension for file: \"" + path + "\". Only .ts and .d.ts extensions are allowed.");
          }
          else {
            compilationEnvironment.ioHost.stderr.WriteLine("Error reading file \"" + path + "\": File not found");
          }

        }
      }
      for (var i = 0; i < compilationEnvironment.code.length; i++) {
        if (!this.isResolved(compilationEnvironment.code[i].path)) {
          var path = compilationEnvironment.code[i].path;
          if (!TypeScript.isSTRFile(path) && !TypeScript.isDSTRFile(path)) {
            compilationEnvironment.ioHost.stderr.WriteLine("Unknown extension for file: \""+path+"\". Only .ts and .d.ts extensions are allowed.");
          }
          else {
            compilationEnvironment.ioHost.stderr.WriteLine("Error reading file \"" + path + "\": File not found");
          }
        }
      }

      return ret;
    }
}

