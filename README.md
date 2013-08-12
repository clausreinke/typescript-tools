
YOU ARE LOOKING AT A TEMPORARY BRANCH for testing TS v0.9.x support. Please test and report any issues. If no major issues arise, this testing branch will be folded back into the main line.

This turned out to be a partial rewrite, and includes a few command/JSON PROTOCOL CHANGES (see below for details):
- symbol command is gone (use type instead)
- type and completion commands now return {line,character} records, whereever positions are concerned

## typescript-tools

typescript-tools provides access to the TypeScript Language Services via a simple commandline server (tss). This makes it easy to build editor plugins supporting TypeScript. A Vim plugin (tss.vim) is included. If you build plugins for other editors/IDEs based on typescript-tools (I've heard rumours of such for Emacs and Sublime), please let me know.

### Installation

npm installation goes somewhat like this:

  ```
  # install git and node/npm, then
  $ git clone git://github.com/clausreinke/typescript-tools.git
  $ cd typescript-tools/
  $ git checkout testing_v0.9
  $ npm install -g
  ```

The installation should give you a global `tss` command, which you can use directly, as in this sample session (note the absolute paths, which will differ in your installation):

  ```
  $ tss tests/test.ts
  "loaded c:/javascript/typescript/0.9/typescript-tools/tests/test.ts, TSS listening.."
  type 4 2 c:/javascript/typescript/0.9/typescript-tools/tests/test.ts
  {"memberName":{"prefix":"{ ","suffix":"}","delim":"; ","entries":[{"prefix":"a: ","suffix":"","delim":"","entries":[{"prefix":"number","suffix":"","delim":"","entries":[{"prefix":"","suffix":"","delim":"","entries":[]}]}]},{"prefix":"b: ","suffix":"","delim":"","entries":[{"prefix":"number","suffix":"","delim":"","entries":[{"prefix":"","suffix":"","delim":"","entries":[]}]}]}]},"docComment":"","fullSymbolName":"x","kind":"var","minChar":41,"limChar":42,"type":"{ a: number; b: number; }"}
  > definition 4 2 c:/javascript/typescript/0.9/typescript-tools/tests/test.ts
  {"def":{"fileName":"c:/javascript/typescript/0.9/typescript-tools/tests/test.ts","minChar":4,"limChar":17,"kind":"var","name":"x","containerKind":"","containerName":""},"file":"c:/javascript/typescript/0.9/typescript-tools/tests/test.ts","min":{"line":1,"character":5},"lim":{"line":1,"character":18}}
  > completions true 4 4 c:/javascript/typescript/0.9/typescript-tools/tests/test.ts
  {"maybeInaccurate":false,"isMemberCompletion":true,"entries":[{"name":"a","kind":"property","kindModifiers":"public","type":"number","fullSymbolName":"a","docComment":""},{"name":"b","kind":"property","kindModifiers":"public","type":"number","fullSymbolName":"b","docComment":""}]}
  quit
  "TSS closing"
  ```

If you want to use tss from Vim, source the `tss.vim` script. If you want to use this from other editors/IDEs, you will need to write some code, to communicate with `tss` as an asynchronous subprocess (please let me know how it goes, especially if you release a working plugin).

From-source compilation should not be necessary, as a pre-compiled `bin/tss.js` is included, as well as a `bin/lib.d.ts`. You might want to modify `bin/defaultLibs.d.ts`, if you want other declaration files included by default.

If you do want to compile from source, you need the typescript sources (I used the develop branch, commit 198f2c3d8d3acc6b077acc43f977858c93702185):

  ```
  # install git and node/npm, then
  $ git clone https://git01.codeplex.com/typescript
  $ git clone git://github.com/clausreinke/typescript-tools.git
  $ (cd typescript; git checkout develop)
  $ (cd typescript-tools/; git checkout testing_v0.9)
  $ node typescript/bin/tsc.js typescript-tools/tss.ts -target es5 -out typescript-tools/bin/tss.js
  ```

TypeScript tools currently available:

## tss.ts: TypeScript Services Server

  Simple commandline interface (commands in, info out) to TypeScript Services. Currently supported commands (with indication of purpose and output format) include:

  ```
  symbol <line> <pos> <file>
    // get symbol information

    !command no longer supported!
    info still available via 'type' command (properties 'fullSymbolName','type')

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

  completions (true|false) <line> <pos> <file>
    // get member/non-member completions

    { entries: [{name: string, type: string, docComment: string}, ...]
    }

  update <linecount> <file> // followed by linecount lines of source text
    // provide current source, if there are unsaved changes

    "updated <file>"

  reload
    // reload current project

    "reloaded <rootfile>, TSS listening.."

  showErrors
    // show compilation errors for current project

    [{file:  string
     ,start: {line: number, character: number}
     ,end:   {line: number, character: number}
     ,text:  string
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


## tss.vim: vim interface to tss.js

  Needs Vim 7.3 (plus Python 2.7 with json lib): :source tss.vim
  Currently assumes that node is in path and that tss has been npm-installed globally.
  See top of file for configuration options.

  In practice, you'll use `:TSSstarthere`, `:TSSend`, `:TSSreload`, `TSStype`, `TSSdef*`, 
  as well as CTRL-X CTRL-O for insert mode completion.

  ```
  " echo symbol/type of item under cursor
  command! TSSsymbol
  command! TSStype

  " jump to definition of item under cursor
  command! TSSdef
  command! TSSdefpreview
  command! TSSdefsplit
  command! TSSdeftab

  " create location list for references
  command! TSSreferences

  " update TSS with current file source
  " TODO: integrate into TSScmd
  command! TSSupdate

  " for use as balloonexpr, symbol under mouse pointer
  " set balloonexpr=TSSballoon()
  " set ballooneval
  function! TSSballoon()

  " completions
  function! TSScompleteFunc(findstart,base)

  " reload project sources
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
  ```

