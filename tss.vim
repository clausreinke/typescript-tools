
" echo symbol/type of item under cursor
command! TSSsymbol echo TSScmd("symbol",{})
command! TSStype echo TSScmd("type",{})

" for use as balloonexpr, symbol under mouse pointer
" set balloonexpr=TSSballoon()
" set ballooneval
function! TSSballoon()
  let file = expand("#".v:beval_bufnr.":p")
  return TSScmd("symbol ".v:beval_lnum." ".v:beval_col." ".file,{'rawcmd':1})
endfunction

" jump to definition of item under cursor
command! TSSdef call TSSdef("edit")
command! TSSdefpreview call TSSdef("pedit")
command! TSSdefsplit call TSSdef("split")
command! TSSdeftab call TSSdef("tabe")
function! TSSdef(cmd)
  let info = TSScmd("definition",{})
  if type(info)!=type({}) || info.file=='null' || type(info.min)!=type([])
    echoerr 'no useable definition information'
    return info
  endif
  if a:cmd=="pedit"
    exe a:cmd.'+'.info.min[0].' '.info.file
  else
    exe a:cmd.' '.info.file
    call cursor(info.min[0],info.min[1])
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
    " echomsg start.":".member

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
set omnifunc=TSScompleteFunc

" reload project sources
command! TSSreload echo TSScmd("reload",{'rawcmd':1})

" create quickfix list from TSS errors
command! TSSshowErrors call TSSshowErrors()
function! TSSshowErrors()
  let info = TSScmd("showErrors",{'rawcmd':1})
  if type(info)==type([])
    for i in info
      let i['lnum']     = i['start']['line']
      let i['col']      = i['start']['col']
      let i['filename'] = i['file']
    endfor
    call setqflist(info)
  else
    echoerr info
  endif
endfunction

" start typescript service process asynchronously, via python
" TODO: the only reason for shell=True is to avoid popup console window;
"       is there a more direct way?
command! -nargs=1 TSSstart call TSSstart(<f-args>)
command! TSSstarthere call TSSstart(expand("%"))
function! TSSstart(projectroot)
echomsg "starting TSS, loading ".a:projectroot."..."
python <<EOF
import subprocess
import vim
import json

projectroot = vim.eval("a:projectroot")
tss = subprocess.Popen(['tss',projectroot]
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
endfunction

" TSS command tracing, off by default
python traceFlag = False

command! -nargs=1 TSStrace call TSStrace(<f-args>)
function! TSStrace(flag)
python <<EOF

traceFlag = vim.eval('a:flag')

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
    tss.stdin.write(cmd+'\n')
  else:
    tss.stdin.write(cmd+' '+str(row)+' '+colArg+' '+filename+'\n')

  if ('lines' in opts):
    for line in opts['lines']:
      tss.stdin.write(line+'\n')

  answer = tss.stdout.readline()
  if traceFlag:
    sys.stdout.write(answer)

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

