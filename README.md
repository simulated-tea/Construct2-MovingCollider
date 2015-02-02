# Collision Aware

## State
Draft.

### Known issues
* no raycasting implemented yet - so no collision detection at high speeds
* no speed awareness: more collision checks then neccessary at low speeds
* bouncing off assuming convex shapes atm. broken inside of concave environments
* bouncing off buggy - not working all the time it seems.
* no own icon provided.

## Disclaimer
This is still work in progress. Comments, feature requests and suggestions, especially regarding integration into Construct 2 or per-frame computation and game mechanics in general, are welcome.

## Development
The .c2addon can be build with grunt. Given a working [node.js](http://nodejs.org/) installation
```
npm install
grunt build
```
should do the trick.
