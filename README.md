
THIS WORK IN PROGRESS! (incomplete, buggy, non-stable, .. ;-)

npm installation goes somewhat like this:

  ```
  install git and node/npm
  clone typescript-tools
  cd typescript-tools
  npm install -g
  ```

  (this will install typescript as a dependency, if you do not have that already, to get its lib.d.ts file)

The installation should give you a global `tss` command. If you want to use this from Vim, source the `tss.vim` script. If you want to use this from other editors/IDEs, you will need to write some code, to communicate with `tss` as an asynchronous subprocess.

From-source compilation, if you want it, needs the typescript sources and goes somewhat like this:

  ```
  install git and node/npm
  clone typescript
  clone typescript-tools
  node typescript/bin/tsc.js typescript-tools/tss.ts -c -target es5 -out typescript-tools/tss.js
  ```

TypeScript tools currently available:

## tss.ts: TypeScript Services Server

  Simple commandline interface (commands in, info out) to TypeScript Services. Currently supported commands include:

  ```
  (symbol|type) <line> <pos> <file>
    // get type information

  definition <line> <pos> <file>
    // get location of definition

  completions (true|false) <line> <pos> <file>
    // get member/non-member completions

  update <linecount> <file> // followed by linecount lines of source text
    // provide current source, if there are unsaved changes

  quit
    // quit tss
  ```

  Assumes that typescript-tools is installed parallel to typescript repo -
  for other configurations, you'll need to adjust the paths near the top of the '.ts' files.

  Start tss.js with project root file - will take several seconds to load 
  all dependencies; then enter commands and get JSON info or error messages
  (NOTE: commands take absolute file paths, adjust example to your installation):

  ```
  $ node tss.js tss.ts
  loaded c:/private/home/javascript/typescript/typescript-tools/tss.ts, TSS listen
  ing..
  > symbol 175 31 c:/private/home/javascript/typescript/typescript-tools/tss.ts
  "compilationEnvironment: CompilationEnvironment"
  > type 175 31 c:/private/home/javascript/typescript/typescript-tools/tss.ts
  "TypeScript.CompilationEnvironment"
  > definition 175 31 c:/private/home/javascript/typescript/typescript-tools/tss.t
  s
  {"def":{"unitIndex":82,"minChar":1150,"limChar":1215,"kind":"property","name":"c
  ompilationEnvironment","containerKind":"","containerName":"TSS"},"file":"c:/priv
  ate/home/javascript/typescript/typescript-tools/tss.ts","min":[35,3],"lim":[35,6
  8]}
  > info 175 31 c:/private/home/javascript/typescript/typescript-tools/tss.ts
  {"pos":5738,"linecol":[175,31],"symbol":"compilationEnvironment: CompilationEnvi
  ronment","type":"TypeScript.CompilationEnvironment","def":{"unitIndex":82,"minCh
  ar":1150,"limChar":1215,"kind":"property","name":"compilationEnvironment","conta
  inerKind":"","containerName":"TSS"},"file":"c:/private/home/javascript/typescrip
  t/typescript-tools/tss.ts","min":[35,3],"lim":[35,68],"completions":{"maybeInacc
  urate":false,"isMemberCompletion":true,"entries":[{"name":"compilationSettings",
  "type":"TypeScript.CompilationSettings","kind":"property","kindModifiers":"publi
  c"},{"name":"compilationEnvironment","type":"TypeScript.CompilationEnvironment",
  "kind":"property","kindModifiers":"public"},{"name":"commandLineHost","type":"Co
  mmandLineHost","kind":"property","kindModifiers":"public"},{"name":"ls","type":"
  Services.ILanguageService","kind":"property","kindModifiers":"public"},{"name":"
  refcode","type":"TypeScript.SourceUnit","kind":"property","kindModifiers":"publi
  c"},{"name":"ioHost","type":"IIO","kind":"property","kindModifiers":"public"},{"
  name":"setup","type":"(file: any) => void","kind":"method","kindModifiers":"publ
  ic"},{"name":"listen","type":"() => void","kind":"method","kindModifiers":"publi
  c"},{"name":"charToLine","type":"(lineMap: any, ch: any) => number[]","kind":"me
  thod","kindModifiers":"private"}]}}
  quit
  TSS closing
  ```

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

