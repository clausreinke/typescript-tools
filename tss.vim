
" echo symbol/type of item under cursor
command! TSSsymbol call TSScmd("symbol")
command! TSStype call TSScmd("type")

" jump to definition of item under cursor
command! TSSdef call TSSdef("edit")
command! TSSdefsplit call TSSdef("split")
command! TSSdeftab call TSSdef("tabe")
function! TSSdef(cmd)
  let info = TSScmd("definition")
  exe a:cmd.' '.info.file
  call cursor(info.min[0],info.min[1])
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
tss = subprocess.Popen(['node','tss.js',projectroot]
                      ,bufsize=0
                      ,stdin=subprocess.PIPE
                      ,stdout=subprocess.PIPE
                      ,stderr=subprocess.PIPE
                      ,shell=True
                      ,universal_newlines=True)

prompt = tss.stdout.readline()
print prompt

EOF
endfunction

" pass a command to typescript service, get answer
command! -nargs=1 TSScmd call TSScmd(<f-args>)
function! TSScmd(cmd)
python <<EOF

(row,col) = vim.current.window.cursor
filename  = vim.current.buffer.name
cmd       = vim.eval("a:cmd")
tss.stdin.write(cmd+' '+str(row)+' '+str(col+1)+' '+filename+'\n')
answer = tss.stdout.readline()
sys.stdout.write(answer)

try:
  result = json.dumps(json.loads(answer,parse_constant=str))
except:
  result = "json error"
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

rest = tss.communicate('quit')[0]
print rest

EOF
endfunction

