Minimal semi-automated testing (results may differ if you are using a different `lib.d.ts`).
```
$ node script.js >script.out

$ diff  script.out*

$ diff --strip-trailing-cr script.dump test.ts
3c3
< s2.
\ No newline at end of file
---
> s2.

```
