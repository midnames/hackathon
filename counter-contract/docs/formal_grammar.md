Compact Grammar
Compact language version 0.17.0.

Notational note: In the grammar productions below, ellipses are used to specify repetition. The notation X ... X, where X is a grammar symbol, represents zero or more occurrences of X. The notation X s ... s X, where X is a grammar symbol and s is a separator such as a comma or or semicolon, represents zero or more occurrences of X separated by s. In either case, when the ellipsis is marked with the superscript 1, the notation represents a sequence containing at least one X. When such a sequence is followed by sopt, an optional trailing separator is allowed, but only if there is at least one X. For example, id … id represents zero or more ids, and expr , …¹ , expr ,opt represents one or more comma-separated exprs possibly followed by an extra comma.

end-of-file (eof)
end of file

identifier (id, module-name, function-name, struct-name, enum-name, contract-name, tvar-name)
identifiers have the same syntax as Typescript identifiers

field-literal (nat)
a field literal is 0 or a natural number formed from a sequence of digits starting with 1-9, e.g. 723, whose value does not exceed the maximum field value

string-literal (str, file)
a string literal has the same syntax as a Typescript string

version-literal (version)
a version literal takes the form nat or nat.nat or nat.nat.nat, e.g., 1.2 or 1.2.3, representing major, minor, and bugfix versions

Compact (program)
program 	→	  pelt … pelt  eof
Program-element (pelt)
pelt 	→	  pragma
 	→	  incld
 	→	  mdefn
 	→	  idecl
 	→	  xdecl
 	→	  ldecl
 	→	  lconstructor
 	→	  cdefn
 	→	  edecl
 	→	  wdecl
 	→	  ecdecl
 	→	  struct
 	→	  enumdef
Pragma (pragma)
pragma 	→	  pragma  id  version-expr  ;
Version-expression (version-expr)
version-expr 	→	  version-expr  ||  version-expr0
 	→	  version-expr0
Version-expression0 (version-expr0)
version-expr0 	→	  version-expr0  &&  version-term
 	→	  version-term
Version-Term (version-term)
version-term 	→	  version-atom
 	→	  !  version-atom
 	→	  <  version-atom
 	→	  <=  version-atom
 	→	  >=  version-atom
 	→	  >  version-atom
 	→	  (  version-expr  )
Version-atom (version-atom)
version-atom 	→	  nat
 	→	  version
Include (incld)
incld 	→	  include  file  ;
Module-definition (mdefn)
mdefn 	→	  exportopt  module  module-name  gparamsopt  {  pelt … pelt  }
Generic-parameter-list (gparams)
gparams 	→	  <  generic-param , … , generic-param ,opt  >
Generic-parameter (generic-param)
generic-param 	→	  #  tvar-name
 	→	  tvar-name
Import-declaration (idecl)
idecl 	→	  import  import-name  gargsopt  import-prefixopt  ;
Import-name (import-name)
import-name 	→	  id
 	→	  file
Import-prefix (import-prefix)
import-prefix 	→	  prefix  id
Generic-argument-list (gargs)
gargs 	→	  <  garg , … , garg ,opt  >
Generic-argument (garg)
garg 	→	  nat
 	→	  type
Export-declaration (xdecl)
xdecl 	→	  export  {  id , … , id ,opt  }  ;opt
Ledger-declaration (ldecl)
ldecl 	→	  exportopt  sealedopt  ledger  id  :  type  ;
Constructor (lconstructor)
lconstructor 	→	  constructor  pattern-parameter-list  block
Circuit-definition (cdefn)
cdefn 	→	  exportopt  pureopt  circuit  function-name  gparamsopt  pattern-parameter-list  :  type  block
External-declaration (edecl)
edecl 	→	  exportopt  circuit  id  gparamsopt  simple-parameter-list  :  type  ;
Witness-declaration (wdecl)
wdecl 	→	  exportopt  witness  id  gparamsopt  simple-parameter-list  :  type  ;
External-contract-declaration (ecdecl)
ecdecl 	→	  exportopt  contract  contract-name  {  ecdecl-circuit ; … ; ecdecl-circuit ;opt  }  ;opt
 	→	  exportopt  contract  contract-name  {  ecdecl-circuit , … , ecdecl-circuit ,opt  }  ;opt
External-contract-circuit (ecdecl-circuit)
ecdecl-circuit 	→	  pureopt  circuit  id  simple-parameter-list  :  type
Structure-definition (struct)
struct 	→	  exportopt  struct  struct-name  gparamsopt  {  typed-identifier ; … ; typed-identifier ;opt  }  ;opt
 	→	  exportopt  struct  struct-name  gparamsopt  {  typed-identifier , … , typed-identifier ,opt  }  ;opt
Enum-definition (enumdef)
enumdef 	→	  exportopt  enum  enum-name  {  id , …¹ , id ,opt  }  ;opt
Typed-identifier (typed-identifier)
typed-identifier 	→	  id  :  type
Simple-parameter-list (simple-parameter-list)
simple-parameter-list 	→	  (  typed-identifier , … , typed-identifier ,opt  )
Typed-pattern (typed-pattern)
typed-pattern 	→	  pattern  :  type
Pattern-parameter-list (pattern-parameter-list)
pattern-parameter-list 	→	  (  typed-pattern , … , typed-pattern ,opt  )
Type (type)
type 	→	  tref
 	→	  Boolean
 	→	  Field
 	→	  Uint  <  tsize  >
 	→	  Uint  <  tsize  ..  tsize  >
 	→	  Bytes  <  tsize  >
 	→	  Opaque  <  str  >
 	→	  Vector  <  tsize  ,  type  >
 	→	  [  type , … , type ,opt  ]
Type-reference (tref)
tref 	→	  id  gargsopt
Type-size (tsize)
tsize 	→	  nat
 	→	  id
Block (block)
block 	→	  {  stmt … stmt  }
Statement (stmt)
stmt 	→	  expr-seq  ;
 	→	  return  expr-seq  ;
 	→	  return  ;
 	→	  if  (  expr-seq  )  stmt  else  stmt
 	→	  if  (  expr-seq  )  stmt
 	→	  for  (  const  id  of  nat  ..  nat  )  stmt
 	→	  for  (  const  id  of  expr-seq  )  stmt
 	→	  const  cbinding , …¹ , cbinding   ;
 	→	  block
Pattern (pattern)
pattern 	→	  id
 	→	  [  patternopt , … , patternopt ,opt  ]
 	→	  {  pattern-struct-elt , … , pattern-struct-elt ,opt  }
Pattern-tuple-element (pattern-tuple-elt)
pattern-tuple-elt 	→	  (empty)
 	→	  pattern
Pattern-struct-element (pattern-struct-elt)
pattern-struct-elt 	→	  id
 	→	  id  :  pattern
Expression-sequence (expr-seq)
expr-seq 	→	  expr
 	→	  expr , …¹ , expr   ,  expr
Expression (expr)
expr 	→	  expr0  ?  expr  :  expr
 	→	  expr0  =  expr
 	→	  expr0  +=  expr
 	→	  expr0  -=  expr
 	→	  expr0
Expression0 (expr0)
expr0 	→	  expr0  ||  expr1
 	→	  expr1
Expression1 (expr1)
expr1 	→	  expr1  &&  expr2
 	→	  expr2
Expression2 (expr2)
expr2 	→	  expr2  ==  expr3
 	→	  expr2  !=  expr3
 	→	  expr3
Expression3 (expr3)
expr3 	→	  expr4  <  expr4
 	→	  expr4  <=  expr4
 	→	  expr4  >=  expr4
 	→	  expr4  >  expr4
 	→	  expr4
Expression4 (expr4)
expr4 	→	  expr4  as  type
 	→	  expr5
Expression5 (expr5)
expr5 	→	  expr5  +  expr6
 	→	  expr5  -  expr6
 	→	  expr6
Expression6 (expr6)
expr6 	→	  expr6  *  expr7
 	→	  expr7
Expression7 (expr7)
expr7 	→	  !  expr7
 	→	  expr8
Expression8 (expr8)
expr8 	→	  expr8  [  nat  ]
 	→	  expr8  .  id
 	→	  expr8  .  id  (  expr , … , expr ,opt  )
 	→	  expr9
Expression9 (expr9)
expr9 	→	  fun  (  expr , … , expr ,opt  )
 	→	  map  (  fun  ,  expr , …¹ , expr ,opt  )
 	→	  fold  (  fun  ,  expr  ,  expr , …¹ , expr ,opt  )
 	→	  [  expr , … , expr ,opt  ]
 	→	  tref  {  struct-arg , … , struct-arg ,opt  }
 	→	  assert  (  expr  ,  str  )
 	→	  disclose  (  expr  )
 	→	  term
Term (term)
term 	→	  id
 	→	  true
 	→	  false
 	→	  nat
 	→	  str
 	→	  pad  (  nat  ,  str  )
 	→	  default  <  type  >
 	→	  (  expr-seq  )
Structure-argument (struct-arg)
struct-arg 	→	  expr
 	→	  id  :  expr
 	→	  ...  expr
Function (fun)
fun 	→	  id  gargsopt
 	→	  arrow-parameter-list  return-typeopt  =>  block
 	→	  arrow-parameter-list  return-typeopt  =>  expr
 	→	  (  fun  )
Return-type (return-type)
return-type 	→	  :  type
Optionally-typed-pattern (optionally-typed-pattern)
optionally-typed-pattern 	→	  pattern
 	→	  typed-pattern
Const-Binding (cbinding)
cbinding 	→	  optionally-typed-pattern  =  expr
Arrow-parameter-list (arrow-parameter-list)
arrow-parameter-list 	→	  (  optionally-typed-pattern , … , optionally-typed-pattern ,opt  )