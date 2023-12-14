/// <reference lib="dom" />

import cowsay from 'cowsay'

const appElement = document.getElementById("app");
appElement.innerHTML = cowsay`Hello, world!`;
