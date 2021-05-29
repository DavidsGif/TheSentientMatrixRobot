/* Imports the THREE.js library and the OBJLoader2 helper function, required to load objs. */
import * as THREE from '../three/build/three.module.js';
import { OBJLoader2 } from '../three/examples/jsm/loaders/OBJLoader2.js';

/* Function to load the heads, the default head is named "closed", because we used to have one with an "open" mouth, for animations. */
export function loadHead({name = 'closed' }) {
  /* This returns a promise, so that it can load the head obj asyncronously, so it doesn't block the page. */
  return new Promise((resolve, reject) => {

    // const texture = new THREE.TextureLoader().load('images/blur.png');
    // console.log('texture', texture);
    /* const faceMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      opacity: 0.5,
      transparent: true,
      // reflective: true,
      side: THREE.FrontSide,
    }); */

    /* Sets the material of the face, with grey color, and other variables.
    The "side: THREE.FrontSide" makes it so only the front of the face has the texture,
    so it looks better in transparency. */
    const faceMaterial = new THREE.MeshPhongMaterial({
      color: 0x111111,
      opacity: 0.5,
      transparent: true,
      // reflective: true,
      side: THREE.FrontSide
    });

    /* obj loader, from THREE.js */
    const loader = new OBJLoader2().setUseIndices(true);

    // load a resource from provided URL synchronously
    loader.load(`./objs/${name}.obj`,
      (object) => {
        object.name = name;

        // set the material to a matt surface
        object.traverse(function (child) {
          if (child instanceof THREE.Mesh) {
            // console.log('Face child', child);
            child.material = faceMaterial;
            // child.material.map = texture;
          }
        });

        /* Set the several variables to determine the position of the head. */
        object.rotation.x = 0;
        object.rotation.y = -0.75;
        object.rotation.z = 0;
        // console.log('HEAD', object);
        object.scale.x = 25;
        object.scale.y = 25;
        object.scale.z = 25;
        object.translateY(3700)
        object.translateX(500)

        /* Returns the loaded head obj */
        resolve(object);
      },
      () => {
        // no updates
      },
      (error) => {
        /* In case of error, prints an error the the console. */
        console.error(error);
        reject(error)
      }, null, false);
  });
};
