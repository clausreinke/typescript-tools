(if you are upgrading from an older version, see CHANGES.txt)

## typescript-tools

typescript-tools (v0.4) provides access to the TypeScript Language Services (v1.5) via a simple commandline server (tss). This makes it easy to build editor plugins supporting TypeScript. A Vim plugin (`typescript_tss.vim`) is included. If you build plugins for other editors/IDEs based on typescript-tools, please let me know, or better: announce them on our new project mailing list.

- Vim plugin: included in this repo (see below for list of features)
- Emacs plugin: https://github.com/aki2o/emacs-tss
- Sublime plugins: https://github.com/Railk/T3S, https://github.com/Phaiax/ArcticTypescript

There is a project mailing list: [typescript-tools@googlegroups.com](https://groups.google.com/forum/#!aboutgroup/typescript-tools), but that has seen so little use that I'm likely to close it again.

For reporting bugs in typescript-tools itself (server or vim plugin), please use our issue tracker instead. That isn't all that suited for discussions, unless they revolve around features or bugs. If you want to announce an editor plugin based on typescript-tools, just file a documentation bug;-)

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
  $ npm install -g typescript-tools
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

If you want to use tss from Vim, add the `typescript-tools` directory to your Vim's `rtp`. If you want to use this from other editors/IDEs, you will need to write some code, to communicate with `tss` as an asynchronous subprocess (please let me know how it goes, especially if you release a working plugin).

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

## vim interface to tss.js

  Needs Vim 7.3 (plus Python 2.7 with json lib): this repo includes a Vim filetype plugin
  for the `typescript` filetype, so just add the path to the repo to your Vim's
  runtime path and enable filetype plugins.
  ```
  filetype plugin on
  au BufRead,BufNewFile *.ts		setlocal filetype=typescript
  set rtp+=<your_path_here>/typescript-tools/
  ```

  If you want to use the npm-installed package path for `typescript-tools` instead of 
  your local git repo path, this npm command should tell you the installed
  package path:
  ```
  npm ls -sg --parseable typescript-tools
  ```

  Currently assumes that node is in path and that tss has been npm-installed globally.
  See top of file `ftplugin/typescript_tss.vim` for configuration options.

  In practice, you'll use `:TSSstarthere`, `:TSSend`, `:TSSreload`, `TSStype`, `TSSdef*`,
  as well as CTRL-X CTRL-O for insert mode completion. Also try the project (file) navigation
  commands. Sometimes, calling `:TSSshowErrors` directly can give enough error
  information for the current file -- eventually, you'll probably have to call
  `:TSSreload` to account for changes in dependencies.

  (TODO: vim plugin demo)

### Vim plugin usage tips

  1. the plugin collaborates with a tss server running in the background (via python and nodejs)
  2. the tss server will pick up source file dependencies (via import and references)
  3. start the tss server while editing your main source file (or your main reference file), by issueing `:TSSstarthere`
  4. now you can use the other commands (or `:TSSend`, to get rid of the background server), even while opening TS sources from the same project in different windows or tabs (but in the same Vim instance)

### Vim plugin commands

  ```
  " echo symbol/type of item under cursor
  command! TSSsymbol
  command! TSStype

  " jump to or show definition of item under cursor
  command! TSSdef
  command! TSSdefpreview
  command! TSSdefsplit
  command! TSSdeftab

  " create location list for references
  command! TSSreferences

  " update TSS with current file source
  command! TSSupdate

  " show TSS errors, with updated current file
  command! TSSshowErrors

  " for use as balloonexpr, symbol under mouse pointer
  " set balloonexpr=TSSballoon()
  " set ballooneval
  function! TSSballoon()

  " completions (omnifunc will be set for all *.ts files)
  function! TSScompleteFunc(findstart,base)

  " open project file, with filename completion
  command! -complete=customlist,TSSfile -nargs=1 TSSfile

  " show project file list in preview window
  command! TSSfiles

  " navigate to project file via popup menu
  command! TSSfilesMenu

  " create and open navigation menu for file navigation bar items
  command! TSSnavigation

  " navigate to items in project
  " 1. narrow down symbols via completion, modulo case/prefix/infix/camelCase
  " 2. offer remaining exact (modulo case) matches as a menu
  command! -complete=customlist,TSSnavigateToItems -nargs=1 TSSnavigateTo

  " reload project sources - will ask you to save modified buffers first
  command! TSSreload

  " start typescript service process (asynchronously, via python)
  command! -nargs=1 TSSstart
  command! TSSstarthere

  " pass a command to typescript service, get answer
  command! -nargs=1 TSScmd call TSScmd(<f-args>,{})

  " check typescript service
  " (None: still running; <num>: exit status)
  command! TSSstatus

  " stop typescript service
  command! TSSend

  " sample keymap
  " (highjacking some keys otherwise used for tags,
  "  since we support jump to definition directly)
  function! TSSkeymap()
  ```
