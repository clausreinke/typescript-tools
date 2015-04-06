
(if you are upgrading from an older version, see CHANGES.txt)

## typescript-tools

typescript-tools (v0.4) provides access to the TypeScript Language Services (v1.5) via a simple commandline server (tss). This makes it easy to build editor plugins supporting TypeScript. Several editor plugins are available. If you build plugins for other editors/IDEs based on typescript-tools, please let me know.

- Vim plugin: https://github.com/clausreinke/typescript-tools.vim
- Emacs plugin: https://github.com/aki2o/emacs-tss
- Sublime plugins: https://github.com/Railk/T3S, https://github.com/Phaiax/ArcticTypescript

For reporting bugs in typescript-tools itself (server or vim plugin), please use our issue tracker. If you want to announce an editor plugin based on typescript-tools, just file a documentation bug;-)

### Installation

npm installation goes somewhat like this - via github:

  ```
  # install git and node/npm, then
  $ git clone git://github.com/clausreinke/typescript-tools.git
  $ cd typescript-tools/
  $ npm install -g
  ```

or via the npm registry (the newest version isn't there yet, waiting for post-1.4.1 typescript package):

  ```
  $ npm install -g clausreinke/typescript-tools
  ```

From-source compilation should not be necessary, as a pre-compiled `bin/tss.js` is included, as well as a `bin/lib.d.ts`. But if you want to rebuild and test tss, you can run `make` in `typescript-tools`.

The installation should give you a global `tss` command, which you can use directly, as in this sample session (note that the absolute paths will differ in your installation):

  ```
  $ tss tests/test.ts
  "loaded c:/javascript/typescript/github/typescript-tools/tests/test.ts, TSS listening.."

  type 4 2 tests/test.ts
  {"kind":"var","kindModifiers":"","textSpan":{"start":38,"length":1},"documentation":[],"type":"(var) x: {\n    a: number;\n    b: number;\n}","docComment":""}

  definition 4 2 tests/test.ts
  {"def":{"fileName":"c:/javascript/typescript/github/typescript-tools/tests/test.ts","textSpan":{"start":4,"length":13},"kind":"var","name":"x","containerName":""},"file":"c:/javascript/typescript/github/typescript-tools/tests/test.ts","min":{"line":1,"character":5},"lim":{"line":1,"character":18}}

  completions 4 4 tests/test.ts
  {"isMemberCompletion":true,"entries":[{"name":"a","kind":"property","kindModifiers":"","type":"(property) a: number","docComment":""},{"name":"b","kind":"property","kindModifiers":"","type":"(property) b: number","docComment":""}]}

  quit
  "TSS closing"
  ```

If you want to use tss from Vim/Emacs/Sublime, see the plugin links above. If you want to use this from other editors/IDEs, you will need to write some code, to communicate with `tss` as an asynchronous subprocess (please let me know how it goes, especially if you release a working plugin).

TypeScript tools currently available:

## tss.ts: TypeScript Services Server

Simple commandline interface (commands in, info out) to TypeScript Services. Currently supported commands (with indication of purpose and output format) include:

  ```
  quickInfo <line> <pos> <file>
    // get type information and documentation

    { type: string
    , docComment: string
    }

  definition <line> <pos> <file>
    // get location of definition

    { file: string
    , min:  { line: number, character: number }
    , lim:  { line: number, character: number }
    }

  completions <line> <pos> <file>
    // get completions

    { entries: [{name: string, type?: string, docComment?: string}, ...]
    }

  completions-brief <line> <pos> <file>
    // get completions without type/docComment details

    { entries: [{name: string}, ...]
    }

  references <line> <pos> <file>
    // get references

    [{ file: string
     , lineText: string
     , min:  { line: number, character: number }
     , lim:  { line: number, character: number }
     }]

  navigationBarItems <file>
    // get list of items to navigate to in <file>

    [{ info: string
     , min:  { line: number, character: number }
     , lim:  { line: number, character: number }
     , childItems: ..recursive..
     }]

  navigateToItems <item>
    // get list of matching items to navigate to in project
    // where matching is modulo case, prefix, infix, camelCase
    // (exposes LS API details occasionally subject to change)

    [{ name: string
     , kind: string
     , kindModifiers: string
     , matchKind: string
     , isCaseSensitive: boolean
     , fileName: string
     , containerName: string
     , containerKind: string
     , min:  { line: number, character: number }
     , lim:  { line: number, character: number }
     }]

  update (nocheck)? <linecount> <file> // followed by linecount lines of source text
    // provide current source, if there are unsaved changes

    "updated <file>, (<syntax>/<semantics>) errors"

    or (probably not a good idea to use this)

    "added <file>, (<syntax>/<semantics>) errors"

  reload
    // reload current project (chasing dependencies from <rootfile>)

    "reloaded <rootfile>, TSS listening.."

  files
    // list files in current project

    [<fileName>,...]

  showErrors
    // show compilation errors for current project
    // (NOTE: global errors have no file/start/end fields)

    [{file?:  string
     ,start?: {line: number, character: number}
     ,end?:   {line: number, character: number}
     ,text:  string
     ,phase: string
     ,category: string
     }
     , ...
    ]

  quit
    // quit tss

    "TSS closing"
  ```

Start `tss` with project root file - may take several seconds to load all
dependencies for larger projects; then enter commands and get JSON info or
error messages.

### configuration: tsconfig.json or commandline options

tss can now be configured the same way as tsc, either via commandline options or
via tsconfig.json files (since about TSv1.5). In both cases, only options that affect
the language service have any effect. As a simple example, loading sources with 
external modules generates errors

```
$ echo showErrors | bin/tss  tests/issue-17.ts
"loaded c:/javascript/typescript/github/typescript-tools/tests/issue-17.ts, TSS
listening.."
showErrors
[{"file":"c:/javascript/typescript/github/typescript-tools/tests/issue-17-import
.ts","start":{"line":1,"character":14},"end":{"line":1,"character":18},"text":"C
annot compile external modules unless the '--module' flag is provided.","code":1
148,"phase":"Syntax","category":"Error"}]
```

unless a module system is selected:

```
$ echo showErrors | bin/tss --module commonjs tests/issue-17.ts
"loaded c:/javascript/typescript/github/typescript-tools/tests/issue-17.ts, TSS
listening.."
showErrors
[]

$ echo showErrors | bin/tss --project tests/ tests/issue-17.ts
"loaded c:/javascript/typescript/github/typescript-tools/tests/issue-17.ts, TSS
listening.."
showErrors
[]

$ cat tests/tsconfig.json
{"compilerOptions": {"target":"ES5","module":"commonjs"} }

```
