Minimal semi-automated testing (results may differ if you are using a different `lib.d.ts`).
```
$ node script.js >script.out2

$ diff --strip-trailing-cr script.out*

$ diff --strip-trailing-cr script.dump test.ts
4c4
< {x. }
\ No newline at end of file
---
> {x. }

```
