(if you are upgrading from an older version, see CHANGES.txt)

## typescript-tools

typescript-tools (v0.4) provides access to the TypeScript Language Services (v1.4) via a simple commandline server (tss). This makes it easy to build editor plugins supporting TypeScript. A Vim plugin (`typescript_tss.vim`) is included. If you build plugins for other editors/IDEs based on typescript-tools, please let me know, or better: announce them on our new project mailing list.

- Vim plugin: included in this repo (see below for list of features)
- Emacs plugin: https://github.com/aki2o/emacs-tss
- Sublime plugin: https://github.com/Railk/T3S

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

From-source compilation should not be necessary, as a pre-compiled `bin/tss.js` is included, as well as a `bin/lib.d.ts`. You might want to modify `bin/defaultLibs.d.ts`, if you want other declaration files included by default. (TODO: get rid of defaultLibs)

If you do want to compile from source:

  ```
  # install git and node/npm, then
  $ git clone https://github.com/Microsoft/TypeScript.git
  $ git clone git://github.com/clausreinke/typescript-tools.git
  $ cd typescript-tools
  $ npm install ../typescript
  $ make
  ```

Alternatively, you can let npm handle the cloning of the typescript dependency:

  ```
  # install git and node/npm, then
  $ git clone git://github.com/clausreinke/typescript-tools.git
  $ cd typescript-tools
  $ npm install
  $ make
  ```

The latter works better at the moment since we currently depend directly on the github version of the typescript package. The former gives you control over where to put the typescript clone, and how much to clone (try --depth 1), once we can drop the github dependency again.

TypeScript tools currently available:

## tss.ts: TypeScript Services Server

  Simple commandline interface (commands in, info out) to TypeScript Services. Currently supported commands (with indication of purpose and output format) include:

  ```
  type <line> <pos> <file>
    // get type information

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

  structure <file>
    // list quick navigation items for <file>; experimental
    // (currently, this exposes getNavigationBarItems data)

    [{ info: string
     , min:  { line: number, character: number }
     , lim:  { line: number, character: number }
     , childItems: <recursive>
     }]

  showErrors
    // show compilation errors for current project

    [{file:  string
     ,start: {line: number, character: number}
     ,end:   {line: number, character: number}
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

  Start `tss` with project root file - may take several seconds to load
  all dependencies; then enter commands and get JSON info or error messages
  (NOTE: commands take absolute file paths, adjust example to your installation);
  for a sample session, see `tests/` (commands in `test.script`, output in `script.out`).


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
  as well as CTRL-X CTRL-O for insert mode completion. Sometimes, calling `:TSSshowErrors`
  directly can give enough error information for the current file -- eventually,
  you'll probably have to call `:TSSreload` to account for changes in dependencies.

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

  " browse url for ES5 global property/method under cursor
  command! TSSbrowse

  " jump to definition of item under cursor
  command! TSSdef
  command! TSSdefpreview
  command! TSSdefsplit
  command! TSSdeftab

  " create location list for references
  command! TSSreferences

  " navigation menu for current file structure
  command! TSSstructure

  " update TSS with current file source
  command! TSSupdate

  " show TSS errors, with updated current file
  command! TSSshowErrors

  " for use as balloonexpr, symbol under mouse pointer
  " set balloonexpr=TSSballoon()
  " set ballooneval
  function! TSSballoon()

  " completions
  function! TSScompleteFunc(findstart,base)

  " open project file, with filename completion
  command! -complete=customlist,TSSfile -nargs=1 TSSfile

  " show project file list in preview window
  command! TSSfiles

  " navigate to project file via popup menu
  command! TSSfilesMenu echo TSSfilesMenu('show')

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
