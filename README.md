
THIS WORK IN PROGRESS! (incomplete, buggy, non-stable, .. ;-)

TypeScript tools currently available

Installation goes somewhat like this:

  install git and node
  clone typescript
  clone typescript-tools
  node typescript/bin/tcs.js typescript-tools/tss.ts -c -target es5 -out typescript-tools/tss.js

tss.ts: TypeScript Services Server

  Simple commandline interface (commands in, info out) to TypeScript Services.

  Assumes that typescript-tools is installed parallel to typescript repo -
  for other configurations, you'll need to adjust the paths near the top of the '.ts' files.

  Start tss.js with project root file - will take several seconds to load 
  all dependencies; then enter commands and get JSON info or error messages:

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

tss.vim: vim interface to tss.js

  Needs Vim 7.3 (plus Python 2.7 with json lib): :source tss.vim
  Currently assumes that node is in path and tss.js is in current directory..

  ```
  " echo symbol/type of item under cursor
  command! TSSsymbol call TSScmd("symbol")
  command! TSStype call TSScmd("type")

  " jump to definition of item under cursor
  command! TSSdef call TSSdef("edit")
  command! TSSdefsplit call TSSdef("split")
  command! TSSdeftab call TSSdef("tabe")

  " start typescript service process asynchronously, via python
  command! -nargs=1 TSSstart call TSSstart(<f-args>)
  command! TSSstarthere call TSSstart(expand("%"))

  " pass a command to typescript service, get answer
  command! -nargs=1 TSScmd call TSScmd(<f-args>)

  " check typescript service
  " (None: still running; <num>: exit status)
  command! TSSstatus call TSSstatus()

  " stop typescript service
  command! TSSend call TSSend()
  ```

