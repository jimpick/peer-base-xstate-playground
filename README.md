# peer-base-xstate-playground
peer-base + xstate + diffy

An experiment to try using [XState](https://xstate.js.org/docs/) to control a
[peer-base](https://github.com/peer-base/peer-base) simulation ... with
a simple terminal-based UI built with [diffy](https://github.com/mafintosh/diffy).

# Usage

```
npm start
```

# Demo

![Demo](https://gateway.ipfs.io/ipfs/QmexLJsg5NSvhNDpcNXCAY3XgAJjEv35qY2BjCPAHTLaqM/xstate-2.gif)

The mini-screencast above shows a simulation with the following steps:

1. starts a [libp2p peer-star rendezvous server](https://github.com/libp2p/js-libp2p-websocket-star-rendezvous) on an unused port
2. starts two subprocesses, "Peer A" and "Peer B", each of which creates a peer-base collaboration (using a replicatable grow array,
   as used in [PeerPad](https://peerpad.net/) 
3. "Peer A" types "abc"
4. "Peer B" types "def"

Because "Peer A" and "Peer B" are connected via the rendezvous server, they sync.

# License

MIT
