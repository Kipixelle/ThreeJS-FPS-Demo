# Online app preview

 https://kipixelle.github.io/ThreeJS-FPS-Demo/


# Run app in local

- Clone the project
- Install **Node.js** and **npm** (https://threejs.org/manual/#en/installation)
- Use ```npm install``` to install **"node_modules"** required for the project
- Use ```npm run dev``` to start the app in local on a browser
- Use ```npm run build``` to build the app in **"dist"** folder, then ```npm run preview``` to preview the built app in local


# Run app in an exe (with NW.js)

## From the cloned project
- Download NW.js here : https://nwjs.io/
- Unzip the **NW.js project** out of this project
- Build the app with ```npm run build``` (check if everything is fine with ```npm run preview```)
- Copy the content of the **"dist"** folder in a new folder named **"package.nw"**
- Add in **"package.nw"** a new file named **"package.json"** with the following content :
  ```
    {
    "name": "basic_app",
    "version": "1.0.0",
    "main": "index.html",
    "window": {
        // "icon": "your_path_to_png_picture",
        "frame": true,
        "width": 1920,
        "height": 1080,
        "position": "center",
        "resizable": false
        }
    }
  ```
- Add the **"package.nw"** folder in the unzip **NW.js project**, next to the *nw.exe*
- Start the *nw.exe*

## From the Release

- Go download the last release
- Unzip it
- Start the *nw.exe*
