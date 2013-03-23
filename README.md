
THIS WORK IN PROGRESS! (incomplete, buggy, non-stable, .. ;-)

npm installation goes somewhat like this:

  ```
  # install git and node/npm, then
  $ git clone git://github.com/clausreinke/typescript-tools.git
  $ cd typescript-tools/
  $ npm install -g
  ```

The installation should give you a global `tss` command, which you can use directly (note the absolute paths, which will differ in your installation).

  ```
  $ tss tests/test.ts
  "loaded c:/javascript/typescript/tstinstall/typescript-tools/tests/test.ts, TSS
  listening.."
  symbol 3 2 c:/javascript/typescript/tstinstall/typescript-tools/tests/test.ts
  "s2: string"
  quit
  "TSS closing"
  ```

If you want to use tss from Vim, source the `tss.vim` script. If you want to use this from other editors/IDEs, you will need to write some code, to communicate with `tss` as an asynchronous subprocess.

From-source compilation should not be necessary, as a pre-compile `bin/tss.js` is included, as well as a `bin/lib.d.ts`. You might want to modify `bin/defaultLibs.d.ts`, if you want other declaration files included by default.

If you do want to compile from source, you need the typescript sources (v0.8.3):

  ```
  # install git and node/npm, then
  $ git clone https://git01.codeplex.com/typescript
  $ git clone git://github.com/clausreinke/typescript-tools.git
  $ (cd typescript; git checkout v0.8.3)
  $ node typescript/bin/tsc.js typescript-tools/tss.ts -c -target es5 -out typescript-tools/bin/tss.js
  ```

TypeScript tools currently available:

## tss.ts: TypeScript Services Server

  Simple commandline interface (commands in, info out) to TypeScript Services. Currently supported commands (with indication of purpose and output format) include:

  ```
  symbol <line> <pos> <file>
    // get symbol information

    string (<symbol>: <type>)

  type <line> <pos> <file>
    // get type information

    { type: string
    , docComment: string
    }

  definition <line> <pos> <file>
    // get location of definition

    { file: string
    , min:  [<line>,<column>]
    , lim:  [<line>,<column>]
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
     ,start: {line: number, col: number}
     ,end:   {line: number, col: number}
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

  ```
  " echo symbol/type of item under cursor
  command! TSSsymbol echo TSScmd("symbol",{})
  command! TSStype echo TSScmd("type",{})

  " jump to definition of item under cursor
  command! TSSdef call TSSdef("edit")
  command! TSSdefpreview call TSSdef("pedit")
  command! TSSdefsplit call TSSdef("split")
  command! TSSdeftab call TSSdef("tabe")

  " update TSS with current file source
  " TODO: integrate into TSScmd
  command! TSSupdate echo TSScmd("update "...

  " for use as balloonexpr, symbol under mouse pointer
  " set balloonexpr=TSSballoon()
  " set ballooneval
  function! TSSballoon()

  " completions
  function! TSScompleteFunc(findstart,base)

  " reload project sources
  command! TSSreload echo TSScmd("reload",{'rawcmd':1})

  " start typescript service process asynchronously, via python
  command! -nargs=1 TSSstart call TSSstart(<f-args>)
  command! TSSstarthere call TSSstart(expand("%"))

  " pass a command to typescript service, get answer
  command! -nargs=1 TSScmd call TSScmd(<f-args>,{})

  " check typescript service
  " (None: still running; <num>: exit status)
  command! TSSstatus call TSSstatus()

  " stop typescript service
  command! TSSend call TSSend()
  ```

