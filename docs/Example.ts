stack = []                     // global data stack
null  = -99999                 // sentinel (any unmistakable value)

────────────────────────────────────────────────────────
-- Branch 1  :  mapA → filterA  (reject multiples of 3)
────────────────────────────────────────────────────────
let cursor = 0
let limit  = 10

function next1() {
  if cursor >= limit {
    push(null)                 // signal end-of-stream
    return
  }
  push(cursor)
  cursor = cursor + 1
}

function mapA() {              // identity (can customise)
  val = pop()
  push(val)
}

function filterA() {           // keep only  x % 3 ≠ 0
  val = pop()
  if val == null { push(null); break }
  if val % 3 == 0 { continue } // retry
  push(val)
}

function branch1() {
  while true {
    next1()
    mapA()
    filterA()
    break                      // one value now on stack
  }
}

────────────────────────────────────────────────────────
-- Branch 2  :  filterB → mapB  (keep even, then identity)
────────────────────────────────────────────────────────
let cursor = 0                 // re-defines cursor/limit
let limit  = 10

function next2() {
  if cursor >= limit {
    push(null)
    return
  }
  push(cursor)
  cursor = cursor + 1
}

function filterB() {           // keep only  x % 2 == 0
  val = pop()
  if val == null { push(null); break }
  if val % 2 != 0 { continue }
  push(val)
}

function mapB() {              // identity for demo
  val = pop()
  push(val)
}

function branch2() {
  while true {
    next2()
    filterB()
    mapB()
    break
  }
}

────────────────────────────────────────────────────────
-- Branch 3  :  pass-through (no filter, identity map)
────────────────────────────────────────────────────────
let cursor = 0
let limit  = 10

function next3() {
  if cursor >= limit {
    push(null)
    return
  }
  push(cursor)
  cursor = cursor + 1
}

function mapC() {              // identity
  val = pop()
  push(val)
}

function branch3() {
  next3()
  mapC()
}

────────────────────────────────────────────────────────
-- Main join loop  :  stop on any sentinel
────────────────────────────────────────────────────────
while true {
  branch1()
  a = pop()
  if a == null break

  branch2()
  b = pop()
  if b == null break

  branch3()
  c = pop()
  if c == null break

  print(a, ", ", b, ", ", c)
}
