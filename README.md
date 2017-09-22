Johnny Cache
============

Simple localStorage interface with timestamp based filtering and management

Installation
------------

**NPM**

    npm install johnny-cache

**CDN**

    <script src="https://unpkg.com/johnny-cache"></script>


Usage
-----

_Note: 

**ES6 Style Import**

    import JohnnyCache from 'johnny-cache';
    let cache = new JohnnyCache()
    cache.set('stage-clothes', { color: black, coatLength: 'long' })
    console.log(cache.get('stage-clothes'))