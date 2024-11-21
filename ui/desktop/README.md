# Goose App

Work in progress on an electron app for Goose. 

```
npm install
export GOOSE_PROVIDER__API_KEY=...
npm start
```

This will run `goosed` from src/bin (currently just copied into place from goose core) listening automatically.

Testing the rust server from source:

See `test.sh` for curl on how to use goose daemon - which is from rust version:

* rust streaming server version of goose at time of writing: https://github.com/block/goose/pull/237

`cargo run -p goose-server`

`./test.sh` (in another shell)