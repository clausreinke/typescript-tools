
""" configuration options - use your .vimrc to change defaults

" assume tss is a globally available command
if !exists("g:TSS")
  let g:TSS = ["tss"]
endif

" assume user wants to inspect errors on project load/reload
if !exists("g:TSSshowErrors")
  let g:TSSshowErrors = 1
endif
""" end configuration options

python <<EOF
import logging
LOG_FILENAME='tsstrace.log'
EOF

" echo symbol/type of item under cursor
" (also show JSDoc in preview window, if known)
command! TSSsymbol echo TSSsymbol("")
function! TSSsymbol(rawcmd)
  if a:rawcmd==""
    let info = TSScmd("type",{})
  else
    let info = TSScmd(a:rawcmd,{'rawcmd':1})
  endif
  if type(info)!=type({}) || !has_key(info,"fullSymbolName") || !has_key(info,"type")
    if a:rawcmd==""
      echoerr 'no useable type information'
      return info
    else " called from ballooneval
      return ""
    endif
  endif
  return info.fullSymbolName.":".info.type
endfunction

command! TSStype echo TSStype()
function! TSStype()
  let info = TSScmd("type",{})
  if type(info)!=type({}) || !has_key(info,"type")
    echoerr 'no useable type information'
    return info
  endif
  if has_key(info,"docComment") && info.docComment!=""
    pclose
    new +setlocal\ previewwindow|setlocal\ buftype=nofile|setlocal\ noswapfile
    exe "normal z" . &previewheight . "\<cr>"
    call append(0,split(info.docComment,"\n"))
    wincmd p
  endif
  return info.type
endfunction

" for use as balloonexpr, symbol under mouse pointer
" set balloonexpr=TSSballoon()
" set ballooneval
function! TSSballoon()
  let file = expand("#".v:beval_bufnr.":p")
  return TSSsymbol("type ".v:beval_lnum." ".v:beval_col." ".file)
endfunction

" jump to definition of item under cursor
command! TSSdef call TSSdef("edit")
command! TSSdefpreview call TSSdef("pedit")
command! TSSdefsplit call TSSdef("split")
command! TSSdeftab call TSSdef("tabe")
function! TSSdef(cmd)
  let info = TSScmd("definition",{})
  if type(info)!=type({}) || info.file=='null' || type(info.min)!=type({})
    \ || type(info.min.line)!=type(0) || type(info.min.character)!=type(0)
    echoerr 'no useable definition information'
    return info
  endif
  if a:cmd=="pedit"
    exe a:cmd.'+'.info.min.line.' '.info.file
  else
    exe a:cmd.' '.info.file
    call cursor(info.min.line,info.min.character)
  endif
  return info
endfunction

" update TSS with current file source
" TODO: integrate into TSScmd
command! TSSupdate echo TSScmd("update ".line('$')." ".expand("%:p"),{'rawcmd':1,'lines':getline(1,line('$'))})

" dump TSS internal file source
command! -nargs=1 TSSdump echo TSScmd("dump ".<f-args>." ".expand("%:p"),{'rawcmd':1})

" completions
command! TSScomplete call TSScomplete()
function! TSScomplete()
  let col   = col(".")
  let line  = getline(".")
  " search backwards for start of identifier (iskeyword pattern)
  let start = col
  while start>0 && line[start-2] =~ "\\k"
    let start -= 1
  endwhile
  " check if preceded by dot (won't see dot on previous line!)
  let member = (start>1 && line[start-2]==".") ? 'true' : 'false'
  " echomsg start.":".member
  let info = TSScmd("completions ".member,{'col':start})
  echo info
  return info
endfunction

function! TSScompleteFunc(findstart,base)
  " echomsg a:findstart."|".a:base
  let col   = col(".")
  let line  = getline(".")

  " search backwards for start of identifier (iskeyword pattern)
  let start = col
  while start>0 && line[start-2] =~ "\\k"
    let start -= 1
  endwhile

  if a:findstart
    return line[start-1] =~ "\\k" ? start-1 : -1
  else
    " check if preceded by dot (won't see dot on previous line!)
    let member = (start>1 && line[start-2]==".") ? 'true' : 'false'
    echomsg start.":".member

    if &modified
      TSSupdate
    endif

    let info = TSScmd("completions ".member,{'col':start})

    let result = []
    if type(info)==type({})
      for entry in info.entries
        if entry['name'] =~ '^'.a:base
          call add(result, {'word': entry['name'], 'menu': entry['type'], 'info': entry['docComment'] })
        endif
      endfor
    endif
    return result
  endif
endfunction
aug TSS
au BufNewFile,BufRead *.ts setlocal omnifunc=TSScompleteFunc
aug END
doau TSS BufRead

" reload project sources
command! TSSreload echo TSSreload()
function! TSSreload()
  let msg = TSScmd("reload",{'rawcmd':1})
  if g:TSSshowErrors
    TSSshowErrors
  endif
  return msg
endfunction

" create quickfix list from TSS errors
command! TSSshowErrors call TSSshowErrors()
function! TSSshowErrors()
  let info = TSScmd("showErrors",{'rawcmd':1})
  if type(info)==type([])
    for i in info
      let i['lnum']     = i['start']['line']
      let i['col']      = i['start']['character']
      let i['filename'] = i['file']
    endfor
    call setqflist(info)
    if len(info)!=0
      copen
    endif
  else
    echoerr info
  endif
endfunction

" create location list for references
command! TSSreferences call TSSreferences()
function! TSSreferences()
  let info = TSScmd("references",{})
  if type(info)==type([])
    for i in info
      let i['lnum']     = i['min']['line']
      let i['col']      = i['min']['character']
      let i['filename'] = i['file']
    endfor
    call setloclist(0,info)
    if len(info)!=0
      lopen
    endif
  else
    echoerr info
  endif
endfunction

" start typescript service process asynchronously, via python
" NOTE: one reason for shell=True is to avoid popup console window;
command! -nargs=1 TSSstart call TSSstart(<f-args>)
command! TSSstarthere call TSSstart(expand("%"))
function! TSSstart(projectroot)
echomsg "starting TSS, loading ".a:projectroot."..."
python <<EOF
import subprocess
import vim
import json

projectroot = vim.eval("a:projectroot")
print(vim.eval("g:TSS")+[projectroot])
tss = subprocess.Popen(vim.eval("g:TSS")+[projectroot]
                      ,bufsize=0
                      ,stdin=subprocess.PIPE
                      ,stdout=subprocess.PIPE
                      ,stderr=subprocess.PIPE
                      ,shell=True
                      ,universal_newlines=True)

prompt = tss.stdout.readline()
sys.stdout.write(prompt)
# print prompt

EOF
  if g:TSSshowErrors
    TSSshowErrors
  endif
endfunction

" TSS command tracing, off by default
python traceFlag = False

command! TSStraceOn call TSStrace('on')
command! TSStraceOff call TSStrace('off')
function! TSStrace(flag)
python <<EOF

if vim.eval('a:flag')=='on':
  traceFlag = True
  logging.basicConfig(filename=LOG_FILENAME,level=logging.DEBUG)
else:
  traceFlag = False
  logger = logging.getLogger()
  logger.handlers[0].stream.close()
  logger.removeHandler(logger.handlers[0])

EOF
endfunction

" pass a command to typescript service, get answer
command! -nargs=1 TSScmd call TSScmd(<f-args>,{})
function! TSScmd(cmd,opts)
python <<EOF

(row,col) = vim.current.window.cursor
filename  = vim.current.buffer.name
opts      = vim.eval("a:opts")
colArg    = opts['col'] if ('col' in opts) else str(col+1)
cmd       = vim.eval("a:cmd")

if tss.poll()==None:
  if ('rawcmd' in opts):
    request = cmd
  else:
    request = cmd+' '+str(row)+' '+colArg+' '+filename

  if traceFlag:
    logging.debug(request)

  tss.stdin.write(request+'\n')

  if ('lines' in opts):
    for line in opts['lines']:
      tss.stdin.write(line+'\n')

  answer = tss.stdout.readline()

  if traceFlag:
    if ('lines' in opts):
      for line in opts['lines']:
        logging.debug(line)
    logging.debug(answer)

  try:
    result = json.dumps(json.loads(answer,parse_constant=str))
  except:
    result = '"null"'

else:
  result = '"TSS not running"'

vim.command("let null = 'null'")
vim.command("let true = 'true'")
vim.command("let false = 'false'")
vim.command("let result = "+result)

EOF
return result
endfunction

" check typescript service
" (None: still running; <num>: exit status)
command! TSSstatus call TSSstatus()
function! TSSstatus()
python <<EOF

rest = tss.poll()
print rest

EOF
endfunction

" stop typescript service
command! TSSend call TSSend()
function! TSSend()
python <<EOF

if tss.poll()==None:
  rest = tss.communicate('quit')[0]
  sys.stdout.write(rest)
else:
  sys.stdout.write('TSS not running\n')

EOF
endfunction

