# Goose UX

Work in progress on an electron app for Goose. 

```
npm install
export OPENAI_API_KEY=...
npm start
```

WIP: 

See test.sh for curl on how to use goose daemon - which is from rust version: 

* rust streaming server version of goose at time of writing: https://github.com/block/goose/pull/237

`cargo run -p goose-server`
`./test.sh` (in another shell)