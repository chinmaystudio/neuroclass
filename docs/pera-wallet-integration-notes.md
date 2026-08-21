# Pera Wallet integration notes

Source: https://docs.perawallet.app/references/pera-connect

The official `@perawallet/connect` SDK uses `new PeraWalletConnect({ chainId: 416002 })` for Algorand TestNet. `connect()` and `reconnectSession()` return account address arrays. `disconnect()` terminates the session. `signTransaction()` accepts grouped signer transactions such as `[[{ txn, signers: [address] }]]` and returns signed transaction bytes. The project uses these methods so browser users sign payments in Pera Wallet without exposing mnemonics to the frontend.
