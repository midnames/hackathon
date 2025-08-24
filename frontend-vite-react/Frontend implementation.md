# Frontend implementation
I want to implement the frontend to interact with a contract:
The contract is in @leaf-contract/src/leaf.compact
I want to be able to:
- Register a domain
- Resolve a domain (@.resolve.ts has an example on how its done)
- Update a domain target

I should be able to call
register_domain(domain: Opaque<'string'>, resolver: ContractAddress):
with (hyper.complex.domain.night, ADDR) and it should resolve it, go to the "complex" registry and add "hyper" with resovler ADDR. 


set_resolver(domain: Opaque<'string'>, resolver: ContractAddress):
with (hyper.complex.domain.night, ADDR) and it should resolve it, go to the "complex" registry and change the "hyper" resolver to ADDR. 

update_domain_target(new_target: Either<ZswapCoinPublicKey, ContractAddress>):
with (hyper.complex.domain.night, ADDR) and it should resolve it, go to the "hyper" resolver and change the TARGET to ADDR 

- Do not implement transfer, as is not finished yet.

Right now the frontend has some capabilites, but review those to understand the system.
You can check how to use the system in @../nameservice/refactor/test/full.ts In that file, the register function is replaced by the buy function, but it works exactly the same without the last parameter.
Remove all functionalities from the nameservice that are not those.
Use bun instead of npm.
Ask for directions when in doubt.
Think before writing code.





For example, in the name-service:

Resolve domain works

Domain info asks for a contract address instead of assuming the TLD and resolving the domain to get the info. Remove the "assume night tld" checkbox. Just assume its that tld.

Contract info can be removed
Ownership too?
Utilities can be updated.
Create domain fails.
Using providers: true
nameservice.ts:599 Creating domain: id.facundo
nameservice.ts:607 Parsed - Domain: id, Parent: facundo.night
nameservice.ts:84 Getting resolver address for: facundo.night
nameservice.ts:100 Looking up 'facundo' in resolver 02008c1c768081c72292b59b83c2123437a1cbdca63912b79c3bc377968fe0e55bbf
nameservice.ts:121 Found resolver contract address: 0200f4785e5c5ed588b20bb35cd4fd0b8adb9b1a062a4f16b50397e47c9ff257080c
nameservice.ts:615 Parent contract found: 0200f4785e5c5ed588b20bb35cd4fd0b8adb9b1a062a4f16b50397e47c9ff257080c
nameservice.ts:633 Wallet coinPublicKey: mn_shield-cpk_test15fnh00gss6rvn70z9hwn40ravz0lqdn0l46tvzd959jsf9kdw7qqpaycr0
nameservice.ts:649 Target configured for wallet
nameservice.ts:652 Deploying leaf contract for domain: id
nameservice.ts:660 Setting private state for key: namespacePrivateState
await in submitDeployTx		
createNewDomain	@	nameservice.ts:660
await in createNewDomain		
handleCreateDomain	@	index.tsx:402
<button>		
Button	@	button.tsx:51
<Button>		
NameService	@	index.tsx:1254
nameservice.ts:660 Setting signing key for key: 02009b82944efc78be13f964cb33b133b380bbd9ee1a859dbd6fbea38fe2c26fac13
await in submitDeployTx		
createNewDomain	@	nameservice.ts:660
await in createNewDomain		
handleCreateDomain	@	index.tsx:402
<button>		
Button	@	button.tsx:51
<Button>		
NameService	@	index.tsx:1254
nameservice.ts:685 Deployed contract at address: 02009b82944efc78be13f964cb33b133b380bbd9ee1a859dbd6fbea38fe2c26fac13
nameservice.ts:688 Registering domain: id in parent contract
nameservice.ts:691 Getting signing key for key: 0200f4785e5c5ed588b20bb35cd4fd0b8adb9b1a062a4f16b50397e47c9ff257080c
await in findDeployedContract		
createNewDomain	@	nameservice.ts:691
await in createNewDomain		
handleCreateDomain	@	index.tsx:402
<button>		
Button	@	button.tsx:51
<Button>		
NameService	@	index.tsx:1254
nameservice.ts:691 Setting signing key for key: 0200f4785e5c5ed588b20bb35cd4fd0b8adb9b1a062a4f16b50397e47c9ff257080c
await in findDeployedContract		
createNewDomain	@	nameservice.ts:691
await in createNewDomain		
handleCreateDomain	@	index.tsx:402
<button>		
Button	@	button.tsx:51
<Button>		
NameService	@	index.tsx:1254
nameservice.ts:691 Setting private state for key: namespacePrivateState
await in findDeployedContract		
createNewDomain	@	nameservice.ts:691
await in createNewDomain		
handleCreateDomain	@	index.tsx:402
<button>		
Button	@	button.tsx:51
<Button>		
NameService	@	index.tsx:1254
nameservice.ts:699 Getting private state for key: namespacePrivateState
await in getStates		
createNewDomain	@	nameservice.ts:699
await in createNewDomain		
handleCreateDomain	@	index.tsx:402
<button>		
Button	@	button.tsx:51
<Button>		
NameService	@	index.tsx:1254
nameservice.ts:699 Setting private state for key: namespacePrivateState
await in submitCallTx		
createNewDomain	@	nameservice.ts:699
await in createNewDomain		
handleCreateDomain	@	index.tsx:402
nameservice.ts:708 Domain id registered. Tx: 000000003fa5420fed38f8acc6d745929726df7e7dfa536bbca6c9960ac0f27fb9113490
index.tsx:663 Uncaught TypeError: Cannot read properties of undefined (reading 'length')
    at formatAddress (index.tsx:663:17)
    at NameService (index.tsx:1282:50)


Register domain should not exist, thats create domain.
Manage domain can be updated. 
Advanced queries can be removed