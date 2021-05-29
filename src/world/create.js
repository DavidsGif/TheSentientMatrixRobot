/* Imports the other js files */
import { world } from './world.js';
import { menu } from './menu.js'

/* When the page loads, executes the function inside */
window.addEventListener('load', () => {
  /* Initializes the world class imported from world.js, which returns a promise.
  The promise returns then returns the world object, which is used to build the now hidden menu. */
  new world().then(world => {
    const container = document.getElementById('main');
    container.appendChild(world.renderer.domElement);

    const menuList = menu(clickee => {
      world.loadNewHead({ name: clickee })
    });
    const menuContainer = document.getElementsByClassName('overlay')[0];
    menuContainer.appendChild(menuList);

    /* document.querySelector('#setCameraBTN').addEventListener('click', () => {
      world.world.updateCameraPos();
    }); */
  });
});
