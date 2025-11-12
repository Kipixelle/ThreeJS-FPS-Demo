# Online app preview

 https://kipixelle.github.io/ThreeJS-FPS-Demo/


# Run the app locally

- Clone the project
- Install **Node.js** and **npm** (https://threejs.org/manual/#en/installation)
- Use ```npm install``` to install node module files required for the project (that will create the **"node_modules"** folder)
- Use ```npm run dev``` to start the app locally on a browser
- Use ```npm run build``` to build the app in **"dist"** folder, then ```npm run preview``` to preview the built app locally


# Run the app in an exe (with NW.js)

## From the cloned project
- Download **NW.js** here : https://nwjs.io/
- Unzip the **NW.js project** out of this project
- Build the app with ```npm run build``` (check if everything is fine with ```npm run preview```)
- Copy the content of the **"dist"** folder to a new folder named **"package.nw"**
- Add in **"package.nw"** a new file named **"package.json"** with the following content :
  ```
    {
    "name": "basic_app",
    "version": "1.0.0",
    "main": "index.html",
    "window": {
        "frame": true,
        "width": 1920,
        "height": 1080,
        "position": "center",
        "resizable": false
        }
    }
  ```
    You can define an icon by adding ```"icon": "path_to_your_picture.png"``` in the *"window"* part of the json below. The picture needs to be placed in the **"public"** folder (for example, if you put your picture in *"public/img/icon.png"*, the corresponding path will be *"img/icon.png"*)

- Add the **"package.nw"** folder in the unzip **NW.js project**, next to the *nw.exe*
- Start the *nw.exe*

## From the Release

- Go download the lastest release
- Unzip it
- Start the *nw.exe*

# License

All the content in this project is licensed under the MIT License.
All the content in the "public" repository is released under the Creative Commons license (CC BY-NC-SA 4.0).
