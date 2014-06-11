// Copyright (c) Microsoft, Claus Reinke. All rights reserved.
// Licensed under the Apache License, Version 2.0. 
// See LICENSE.txt in the project root for complete license information.

///<reference path='../typescript/src/compiler/io.ts'/>
///<reference path='../typescript/src/compiler/typescript.ts'/>
///<reference path='../typescript/src/services/typescriptServices.ts' />

// from src/harness/harness.ts, without the test (TODO: remove shim stuff again)

function switchToForwardSlashes(path: string) {
    return path.replace(/\\/g, "/");
}

function readFile(file) { return TypeScript.Environment.readFile(file,null) }

declare module process {
    export function nextTick(callback: () => any): void;
    export function on(event: string, listener: Function): any;
}

module Harness {
    // Settings 
    export var userSpecifiedroot = "";
    var global = <any>Function("return this").call(null);

    /** Splits the given string on \r\n or on only \n if that fails */
    export function splitContentByNewlines(content: string) {
        // Split up the input file by line
        // Note: IE JS engine incorrectly handles consecutive delimiters here when using RegExp split, so
        // we have to string-based splitting instead and try to figure out the delimiting chars
        var lines = content.split('\r\n');
        if (lines.length === 1) {
            lines = content.split('\n');
        }
        return lines;
    }

    export class ScriptInfo {
        public version: number = 1;
        public editRanges: { length: number; textChangeRange: TypeScript.TextChangeRange; }[] = [];
        public lineMap: TypeScript.LineMap = null;

        constructor(public fileName: string, public content: string, public isOpen = true, public byteOrderMark: TypeScript.ByteOrderMark = TypeScript.ByteOrderMark.None) {
            this.setContent(content);
        }

        private setContent(content: string): void {
            this.content = content;
            this.lineMap = TypeScript.LineMap1.fromString(content);
        }

        public updateContent(content: string): void {
            var old_length = this.content.length;
            this.setContent(content);
            this.editRanges.push({
                length: content.length,
                textChangeRange:
                    // NOTE: no shortcut for "update everything" (null only works in some places, #10)
                    new TypeScript.TextChangeRange(new TypeScript.TextSpan(0, old_length), content.length)
            });
            this.version++;
        }

        public editContent(minChar: number, limChar: number, newText: string): void {
            // Apply edits
            var prefix = this.content.substring(0, minChar);
            var middle = newText;
            var suffix = this.content.substring(limChar);
            this.setContent(prefix + middle + suffix);

            // Store edit range + new length of script
            this.editRanges.push({
                length: this.content.length,
                textChangeRange: new TypeScript.TextChangeRange(
                    TypeScript.TextSpan.fromBounds(minChar, limChar), newText.length)
            });

            // Update version #
            this.version++;
        }

        public getTextChangeRangeBetweenVersions(startVersion: number, endVersion: number): TypeScript.TextChangeRange {
            if (startVersion === endVersion) {
                // No edits!
                return TypeScript.TextChangeRange.unchanged;
            }

            var initialEditRangeIndex = this.editRanges.length - (this.version - startVersion);
            var lastEditRangeIndex = this.editRanges.length - (this.version - endVersion);

            var entries = this.editRanges.slice(initialEditRangeIndex, lastEditRangeIndex);
            return TypeScript.TextChangeRange.collapseChangesAcrossMultipleVersions(entries.map(e => e.textChangeRange));
        }
    }

    class ScriptSnapshotShim implements TypeScript.Services.IScriptSnapshotShim {
        private lineMap: TypeScript.LineMap = null;
        private textSnapshot: string;
        private version: number;

        constructor(private scriptInfo: ScriptInfo) {
            this.textSnapshot = scriptInfo.content;
            this.version = scriptInfo.version;
        }

        public getText(start: number, end: number): string {
            return this.textSnapshot.substring(start, end);
        }

        public getLength(): number {
            return this.textSnapshot.length;
        }

        public getLineStartPositions(): string {
            if (this.lineMap === null) {
                this.lineMap = TypeScript.LineMap1.fromString(this.textSnapshot);
            }

            return JSON.stringify(this.lineMap.lineStarts());
        }

        public getTextChangeRangeSinceVersion(scriptVersion: number): string {
            var range = this.scriptInfo.getTextChangeRangeBetweenVersions(scriptVersion, this.version);
            if (range === null) {
                return null;
            }

            return JSON.stringify({ span: { start: range.span().start(), length: range.span().length() }, newLength: range.newLength() });
        }
    }

    export class TypeScriptLS implements TypeScript.Services.ILanguageServiceShimHost {
        private ls: TypeScript.Services.ILanguageServiceShim = null;

        private fileNameToScript = new TypeScript.StringHashTable<ScriptInfo>();

        constructor(private cancellationToken: TypeScript.ICancellationToken = TypeScript.CancellationToken.None) {
        }

        public addDefaultLibrary() {
            throw("addDefaultLibrary not implemented");
            this.addScript("lib.d.ts", null);
        }

        public addFile(fileName: string) {
            var code = readFile(fileName).contents;
            this.addScript(fileName, code);
        }

        public getScriptInfo(fileName: string): ScriptInfo { // originally private
            return this.fileNameToScript.lookup(fileName);
        }

        public addScript(fileName: string, content: string) {
            var script = new ScriptInfo(fileName, content);
            this.fileNameToScript.add(fileName, script);
        }

        public updateScript(fileName: string, content: string) {
            var script = this.getScriptInfo(fileName);
            if (script !== null) {
                script.updateContent(content);
                return;
            }

            this.addScript(fileName, content);
        }

        public editScript(fileName: string, minChar: number, limChar: number, newText: string) {
            var script = this.getScriptInfo(fileName);
            if (script !== null) {
                script.editContent(minChar, limChar, newText);
                return;
            }

            throw new Error("No script with name '" + fileName + "'");
        }

        //////////////////////////////////////////////////////////////////////
        // ILogger implementation
        //
        public information(): boolean { return false; }
        public debug(): boolean { return true; }
        public warning(): boolean { return true; }
        public error(): boolean { return true; }
        public fatal(): boolean { return true; }

        public log(s: string): void {
            // For debugging...
            //TypeScript.Environment.printLine("TypeScriptLS:" + s);
        }

        // collect Diagnostics
        public getErrors(): TypeScript.Diagnostic[] {
            var addPhase = phase => d => {d.phase = phase; return d};
            var errors = [];
            this.ls.refresh(false);
            this.fileNameToScript.getAllKeys().forEach( file=>{
              var syntactic = this.ls.languageService.getSyntacticDiagnostics(file);
              var semantic = this.ls.languageService.getSemanticDiagnostics(file);
              // this.ls.languageService.getEmitOutput(file).diagnostics);
              errors = errors.concat(syntactic.map(addPhase("Syntax"))
                                    ,semantic.map(addPhase("Semantics")));
            });
            return errors;
        }

        //////////////////////////////////////////////////////////////////////
        // ILanguageServiceShimHost implementation
        //

        public getCompilationSettings(): string/*json for Tools.CompilationSettings*/ {
            return ""; // i.e. default settings
        }

        public getCancellationToken(): TypeScript.ICancellationToken {
            return this.cancellationToken;
        }

        public getScriptFileNames(): string {
            return JSON.stringify(this.fileNameToScript.getAllKeys());
        }

        public getScriptSnapshot(fileName: string): TypeScript.Services.IScriptSnapshotShim {
            return new ScriptSnapshotShim(this.getScriptInfo(fileName));
        }

        public getScriptVersion(fileName: string): number {
            return this.getScriptInfo(fileName).version;
        }

        public getScriptIsOpen(fileName: string): boolean {
            return this.getScriptInfo(fileName).isOpen;
        }

        public getScriptByteOrderMark(fileName: string): TypeScript.ByteOrderMark {
            return this.getScriptInfo(fileName).byteOrderMark;
        }

        public getDiagnosticsObject(): TypeScript.Services.ILanguageServicesDiagnostics {
            return new LanguageServicesDiagnostics("");
        }

        public getLocalizedDiagnosticMessages(): string {
            return "";
        }

        public fileExists(s: string) {
            return TypeScript.Environment.fileExists(s);
        }

        public directoryExists(s: string) {
            return TypeScript.Environment.directoryExists(s);
        }

        public resolveRelativePath(path: string, directory: string): string {
            if (TypeScript.isRooted(path) || !directory) {
                return TypeScript.Environment.absolutePath(path);
            }
            else {
                return TypeScript.Environment.absolutePath(TypeScript.IOUtils.combine(directory, path));
            }
        }

        public getParentDirectory(path: string): string {
            return TypeScript.Environment.directoryName(path);
        }

        /** Return a new instance of the language service shim, up-to-date wrt to typecheck.
         *  To access the non-shim (i.e. actual) language service, use the "ls.languageService" property.
         */
        public getLanguageService(): TypeScript.Services.ILanguageServiceShim {
            var ls = new TypeScript.Services.TypeScriptServicesFactory().createLanguageServiceShim(this);
            ls.refresh(true);
            this.ls = ls;
            return ls;
        }

        /** Parse file given its source text */
        public parseSourceText(fileName: string, sourceText: TypeScript.IScriptSnapshot): TypeScript.SourceUnitSyntax {
            var compilationSettings = new TypeScript.CompilationSettings();
            compilationSettings.codeGenTarget = TypeScript.LanguageVersion.EcmaScript5;

            var settings = TypeScript.ImmutableCompilationSettings.fromCompilationSettings(compilationSettings);
            var parseOptions = settings.codeGenTarget();
            return TypeScript.Parser.parse(fileName, TypeScript.SimpleText.fromScriptSnapshot(sourceText), parseOptions, TypeScript.isDTSFile(fileName)).sourceUnit();
        }

        /** Parse a file on disk given its fileName */
        public parseFile(fileName: string) {
            var sourceText = TypeScript.ScriptSnapshot.fromString(readFile(fileName).contents)
            return this.parseSourceText(fileName, sourceText);
        }

        /**
         * @param line 1 based index
         * @param col 1 based index
        */
        public lineColToPosition(fileName: string, line: number, col: number): number {
            var script: ScriptInfo = this.fileNameToScript.lookup(fileName);

            return script.lineMap.getPosition(line - 1, col - 1);
        }

        /**
         * @param line 1 based index
         * @param col 1 based index
        */
        public positionToLineCol(fileName: string, position: number): TypeScript.ILineAndCharacter {
            var script: ScriptInfo = this.fileNameToScript.lookup(fileName);

            var result = script.lineMap.getLineAndCharacterFromPosition(position);

            return { line: result.line()+1, character: result.character()+1 };
        }

        /**
         * @param line 0 based index
         * @param col 0 based index
        */
        public positionToZeroBasedLineCol(fileName: string, position: number): TypeScript.ILineAndCharacter {
            var script: ScriptInfo = this.fileNameToScript.lookup(fileName);

            var result = script.lineMap.getLineAndCharacterFromPosition(position);

            return { line: result.line(), character: result.character() };
        }

        /** Verify that applying edits to sourceFileName result in the content of the file baselineFileName */
        public checkEdits(sourceFileName: string, baselineFileName: string, edits: TypeScript.Services.TextEdit[]) {
            var script = readFile(sourceFileName);
            var formattedScript = this.applyEdits(script.contents, edits);
            var baseline = readFile(baselineFileName).contents;

        }


        /** Apply an array of text edits to a string, and return the resulting string. */
        public applyEdits(content: string, edits: TypeScript.Services.TextEdit[]): string {
            var result = content;
            edits = this.normalizeEdits(edits);

            for (var i = edits.length - 1; i >= 0; i--) {
                var edit = edits[i];
                var prefix = result.substring(0, edit.minChar);
                var middle = edit.text;
                var suffix = result.substring(edit.limChar);
                result = prefix + middle + suffix;
            }
            return result;
        }

        /** Normalize an array of edits by removing overlapping entries and sorting entries on the minChar position. */
        private normalizeEdits(edits: TypeScript.Services.TextEdit[]): TypeScript.Services.TextEdit[] {
            var result: TypeScript.Services.TextEdit[] = [];

            function mapEdits(edits: TypeScript.Services.TextEdit[]): { edit: TypeScript.Services.TextEdit; index: number; }[] {
                var result: { edit: TypeScript.Services.TextEdit; index: number; }[] = [];
                for (var i = 0; i < edits.length; i++) {
                    result.push({ edit: edits[i], index: i });
                }
                return result;
            }

            var temp = mapEdits(edits).sort(function (a, b) {
                var result = a.edit.minChar - b.edit.minChar;
                if (result === 0)
                    result = a.index - b.index;
                return result;
            });

            var current = 0;
            var next = 1;
            while (current < temp.length) {
                var currentEdit = temp[current].edit;

                // Last edit
                if (next >= temp.length) {
                    result.push(currentEdit);
                    current++;
                    continue;
                }
                var nextEdit = temp[next].edit;

                var gap = nextEdit.minChar - currentEdit.limChar;

                // non-overlapping edits
                if (gap >= 0) {
                    result.push(currentEdit);
                    current = next;
                    next++;
                    continue;
                }

                // overlapping edits: for now, we only support ignoring an next edit 
                // entirely contained in the current edit.
                if (currentEdit.limChar >= nextEdit.limChar) {
                    next++;
                    continue;
                }
                else {
                    throw new Error("Trying to apply overlapping edits");
                }
            }

            return result;
        }
    }

    export class LanguageServicesDiagnostics implements TypeScript.Services.ILanguageServicesDiagnostics {

        constructor(private destination: string) { }

        public log(content: string): void {
            TypeScript.Environment.standardError.WriteLine(content);
            //Imitates the LanguageServicesDiagnostics object when not in Visual Studio
        }

    }


}
