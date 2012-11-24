// Copyright (c) Microsoft, Claus Reinke. All rights reserved.
// Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='../typescript/src/compiler/io.ts'/>
///<reference path='../typescript/src/compiler/typescript.ts'/>
///<reference path='../typescript/src/services/typescriptServices.ts' />

declare var IO: IIO;

// from src/harness/harness.ts, without the test and shim stuff
module Harness {

    export class ScriptInfo {
        public version: number;
        public editRanges: { length: number; editRange: TypeScript.ScriptEditRange; }[] = [];

        constructor (public name: string, public content: string, public isResident: bool, public maxScriptVersions: number) {
            this.version = 1;
        }

        public updateContent(content: string, isResident: bool) {
            this.editRanges = [];
            this.content = content;
            this.isResident = isResident;
            this.version++;
        }

        public editContent(minChar: number, limChar: number, newText: string) {
            // Apply edits
            var prefix = this.content.substring(0, minChar);
            var middle = newText;
            var suffix = this.content.substring(limChar);
            this.content = prefix + middle + suffix;

            // Store edit range + new length of script
            this.editRanges.push({
                length: this.content.length,
                editRange: new TypeScript.ScriptEditRange(minChar, limChar, (limChar - minChar) + newText.length)
            });

            if (this.editRanges.length > this.maxScriptVersions) {
                this.editRanges.splice(0, this.maxScriptVersions - this.editRanges.length);
            }

            // Update version #
            this.version++;
        }

        public getEditRangeSinceVersion(version: number): TypeScript.ScriptEditRange {
            if (this.version == version) {
                // No edits!
                return null;
            }

            var initialEditRangeIndex = this.editRanges.length - (this.version - version);
            if (initialEditRangeIndex < 0 || initialEditRangeIndex >= this.editRanges.length) {
                // Too far away from what we know
                return TypeScript.ScriptEditRange.unknown();
            }

            var entries = this.editRanges.slice(initialEditRangeIndex);

            var minDistFromStart = entries.map(x => x.editRange.minChar).reduce((prev, current) => Math.min(prev, current));
            var minDistFromEnd = entries.map(x => x.length - x.editRange.limChar).reduce((prev, current) => Math.min(prev, current));
            var aggDelta = entries.map(x => x.editRange.delta).reduce((prev, current) => prev + current);

            return new TypeScript.ScriptEditRange(minDistFromStart, entries[0].length - minDistFromEnd, aggDelta);
        }
    }

    export class TypeScriptLS implements Services.ILanguageServiceHost {
        private ls: Services.ILanguageService = null;

        public scripts: ScriptInfo[] = [];
        public maxScriptVersions = 100;

        public addFile(name: string, isResident = false) {
            var code: string = IO.readFile(name);
            this.addScript(name, code, isResident);
        }

        public addScript(name: string, content: string, isResident = false) {
            var script = new ScriptInfo(name, content, isResident, this.maxScriptVersions);
            this.scripts.push(script);
        }

        public updateScript(name: string, content: string, isResident = false) {
            for (var i = 0; i < this.scripts.length; i++) {
                if (this.scripts[i].name == name) {
                    this.scripts[i].updateContent(content, isResident);
                    return;
                }
            }

            this.addScript(name, content, isResident);
        }

        public editScript(name: string, minChar: number, limChar: number, newText: string) {
            for (var i = 0; i < this.scripts.length; i++) {
                if (this.scripts[i].name == name) {
                    this.scripts[i].editContent(minChar, limChar, newText);
                    return;
                }
            }

            throw new Error("No script with name '" + name + "'");
        }

        public getScriptContent(scriptIndex: number): string {
            return this.scripts[scriptIndex].content;
        }

        //////////////////////////////////////////////////////////////////////
        // ILogger implementation
        //
        public information(): bool { return false; }
        public debug(): bool { return true; }
        public warning(): bool { return true; }
        public error(): bool { return true; }
        public fatal(): bool { return true; }

        public log(s: string): void {
            // For debugging...
            //IO.printLine("TypeScriptLS:" + s);
        }

        //////////////////////////////////////////////////////////////////////
        // ILanguageServiceHost implementation
        //

        public getCompilationSettings(): TypeScript.CompilationSettings {
            return null; // i.e. default settings
        }

        public getScriptCount(): number {
            return this.scripts.length;
        }

        public getScriptSourceText(scriptIndex: number, start: number, end: number): string {
            return this.scripts[scriptIndex].content.substring(start, end);
        }

        public getScriptSourceLength(scriptIndex: number): number {
            return this.scripts[scriptIndex].content.length;
        }

        public getScriptId(scriptIndex: number): string {
            return this.scripts[scriptIndex].name;
        }

        public getScriptIsResident(scriptIndex: number): bool {
            return this.scripts[scriptIndex].isResident;
        }

        public getScriptVersion(scriptIndex: number): number {
            return this.scripts[scriptIndex].version;
        }

        public getScriptEditRangeSinceVersion(scriptIndex: number, scriptVersion: number): TypeScript.ScriptEditRange {
            var range = this.scripts[scriptIndex].getEditRangeSinceVersion(scriptVersion);
            return range;
        }

        //
        // Return a new instance of the language service shim, up-to-date wrt to typecheck.
        // To access the non-shim (i.e. actual) language service, use the "ls.languageService" property.
        //
        public getLanguageService(): Services.ILanguageService {
            var ls = new Services.TypeScriptServicesFactory().createLanguageService(this);
            ls.refresh();
            this.ls = ls;
            return ls;
        }

        //
        // Parse file given its source text
        //
        public parseSourceText(fileName: string, sourceText: TypeScript.ISourceText): TypeScript.Script {
            var parser = new TypeScript.Parser();
            parser.setErrorRecovery(null, -1, -1);
            parser.errorCallback = (a, b, c, d) => { };

            var script = parser.parse(sourceText, fileName, 0);
            return script;
        }

        //
        // Parse a file on disk given its filename
        //
        public parseFile(fileName: string) {
            var sourceText = new TypeScript.StringSourceText(IO.readFile(fileName))
            return this.parseSourceText(fileName, sourceText);
        }

        //
        // line and column are 1-based
        //
        public lineColToPosition(fileName: string, line: number, col: number): number {
            var script = this.ls.getScriptAST(fileName);

            return TypeScript.getPositionFromLineColumn(script, line, col);
        }

        //
        // line and column are 1-based
        //
        public positionToLineCol(fileName: string, position: number): TypeScript.ILineCol {
            var script = this.ls.getScriptAST(fileName);

            var result = TypeScript.getLineColumnFromPosition(script, position);

            return result;
        }



    }

}
