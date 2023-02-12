# how to build exe
# tutorial link
    https://www.youtube.com/watch?v=N-3s3ezYd8g&t=31315s
# Packager source
    https://github.com/electron/electron-packager
# install Package
    npm install --save-dev electron-packager
    or 
    npm install electron-packager -g
# build command for current os
    npx electron-packager .
# high cart
        https://api.highcharts.com/highcharts/title

let to_timestamp=moment().startOf("day").unix();
console.log(moment.unix(to_timestamp).format("MM/DD/YYYY HH:mm:s"));