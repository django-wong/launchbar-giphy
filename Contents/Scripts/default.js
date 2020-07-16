// LaunchBar Action Script

function run(argument) {
    if (!throttle(300)) {
        return [];
    }

    if (!argument) {
        return ListTrendingOrSettings();
    }

    const results = [];
    if (!Action.preferences.key) {
        results.push({
            title: "Set GIPHY Key",
            action: "SetKey",
            icon: 'font-awesome:fa-cog',
            actionArgument: argument
        });
        return results;
    }

    const gifs = Search(argument);
    return results.concat(gifs);
}

function runWithURL(url) {
    const matches = url.match(/^https:\/\/giphy.com\/gifs\/.*?([^-?#&]*)$/);
    if (!matches) {
        return [{title: 'No Giphy URL was found', icon: 'font-awesome:fa-exclamation-circle'}];
    }

    return FindImageByID(matches[1]);
}

function FindImageByID(id) {
    const url = `https://api.giphy.com/v1/gifs/${id}?api_key=${Action.preferences.key}`;
    const response = HTTP.getJSON(url);
    return ShowDetail(response.data.data);
}

function ListTrendingOrSettings() {
    if (LaunchBar.options.commandKey) {
        return ListSettings();
    }
    return ListTrending();
}


function ListTrending(page = 1) {
    page = Math.max(parseInt(page), 1);
    const key = Action.preferences.key;
    const limit = 5;
    const path = 'https://api.giphy.com/v1/gifs/trending';
    const url = `${path}?api_key=${key}&limit=${limit}&offset=${(page - 1) * limit}&rating=R&lang=en`;
    const response = HTTP.getJSON(url);
    if (!response || !response.data || !response.data.data) {
        return {
            title: 'No Gif was found',
            icon: '🤧'
        };
    }

    const images = response.data.data;
    const results = images.map((item, index) => {
        const file = Download(item.id, item.images.preview_gif.url);
        return {
            title: item.title,
            icon: file,
            badge: item.type.toUpperCase(),
            url: item.url,
            rating: item.rating,
            quickLookURL: `file://${file}`,
            label: index === 0 ? '⌘ + Y to Preview' : undefined,
            actionReturnsItems: true,
            action: 'ShowDetail',
            actionArgument: item
        };
    });

    if (results.length === limit) {
        results.push({
            icon: 'font-awesome:fa-angle-down',
            title: 'More...',
            action: 'ListTrending',
            actionArgument: (page + 1).toString(),
            actionReturnsItems: false
        });
    }

    return results;
}

function ListSettings() {
    const results = [];
    const path = GetCacheDir();
    results.push({
        title: 'Remove saved API key',
        action: 'SetKey',
        icon: 'font-awesome:fa-cog',
        actionArgument: ''
    });

    results.push({
        title: 'Clean cache',
        action: 'CleanCache',
        icon: 'font-awesome:fa-trash',
        children: [
            {
                title: path,
                path: path
            }
        ]
    });
    return results;
}

/**
 * Sets API key.
 *
 * @class      SetKey (name)
 * @param      {string}  argument  The argument
 * @return     {Array}   Empty output
 */
function SetKey(argument) {
    Action.preferences.key = argument;
    return [];
}


/**
 * Searches for Gifs
 *
 * @class      Search
 * @param      {string}  argument  The argument, example "keywork:page"
 * @return     {Array<Outout>}
 */
function Search(argument) {
    let [keyword, page] = argument.split(':');
    page = parseInt(page) || 0;
    const key = Action.preferences.key;
    const search = encodeURIComponent(keyword);
    const limit = 5;
    const path = 'https://api.giphy.com/v1/gifs/search';
    const url = `${path}?api_key=${key}&q=${search}&limit=${limit}&offset=${page * limit}&rating=R&lang=en`;
    const response = HTTP.getJSON(url);
    if (!response || !response.data || !response.data.data) {
        return {
            title: 'No Gif was found',
            icon: '🤧'
        };
    }

    const images = response.data.data;
    const results = images.map((item, index) => {
        const file = Download(item.id, item.images.preview_gif.url);
        return {
            title: item.title,
            icon: file,
            badge: item.type.toUpperCase(),
            url: item.url,
            rating: item.rating,
            quickLookURL: `file://${file}`,
            label: index === 0 ? '⌘ + Y to Preview' : undefined,
            actionReturnsItems: true,
            action: 'ShowDetail',
            actionArgument: item
        };
    });

    if (results.length === limit) {
        results.push({
            title: 'More...',
            icon: 'font-awesome:fa-angle-down',
            action: 'Search',
            actionArgument: `${keyword}:${page + 1}`,
            actionReturnsItems: false
        });
    }

    if (results.length === 0) {
        results.push({
            title: 'No Data',
            icon: 'font-awesome:fa-info-circle'
        });
    }

    return results;
}



/**
 * Gets all available images of given item.
 *
 * @class      GetImages
 * @param      {object}  item    The item
 * @return     {Array}   The images.
 */
function GetImages(item) {
    const results = [];
    Object.keys(item.images).forEach((key) => {
        const image = item.images[key];
        if (!image.url || !image.width || !image.size) {
            return;
        }
        results.push({
            title: ToTitleCase(key.split('_').join(' ')),
            badge: `${image.width}×${image.height}`,
            icon: 'font-awesome:fa-image',
            actionReturnsItems: true,
            action: "SetClipboard",
            // actionRunsInBackground: true,
            actionArgument: {
                url: image.url,
                id: item.id
            },
            url: image.url,
            quickLookURL: image.url,
            label: image.size ? parseInt(image.size / 1000) + 'KB' : undefined,
            subtitle: image.url,
            alwaysShowsSubtitle: true
        });
    });
    return results;
}


/**
 * Download Gif and copy to clipboard.
 *
 * @class      SetClipboard
 * @param      {void}  option  The option
 */
function SetClipboard(option) {
    const url = option.url;
    const id = option.id;
    const dist = Download(id, url);
    LaunchBar.execute('./copy-image', dist);
    return [{
        path: dist
    }];
}



/**
 * Download file with id and cache
 *
 * @class      Download
 * @param      {string}  id      The identifier
 * @param      {string}  url     The url
 * @return     {string}  File path in $TMPDIR
 */
function Download(id, url) {
    const dist = GetFilePathByIdAndUrl(id, url);
    if (!File.exists(dist)) {
        // LaunchBar.execute('/usr/bin/curl', url, '-o', dist);
        const result = HTTP.getData(url);
        File.writeData(result.data, dist);
    }
    return dist;
}



/**
 * Gets the file path by identifier and url.
 *
 * @class      GetFilePathByIdAndUrl (name)
 * @param      {number}  id      The identifier
 * @param      {string}  url     The url
 * @return     {string}  The file path by identifier and url.
 */
function GetFilePathByIdAndUrl(id, url) {
    const path = GetCacheDir();
    const filename = url.substring(url.lastIndexOf('/') + 1);
    return `${path}/${id}${filename}`;
}

/**
 * Covert string to Title Case
 *
 * @class      ToTitleCase
 */
function ToTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}


/**
 * Gets the cache dir.
 *
 * @class      GetCacheDir (name)
 * @return     {string}  The cache dir.
 */
function GetCacheDir() {
    const tmpDir = Action.cachePath;
    const path = `${tmpDir}/images`;
    if (!File.isDirectory(path)) {
        File.createDirectory(path);
    }
    return path;
}


/**
 * Clean cached images
 *
 * @class      CleanCache
 */
function CleanCache() {
    const path = GetCacheDir();
    LaunchBar.execute('/bin/bash', '-c', `rm -f ${path}/*`);
}


/**
 * Returns an Gif detail.
 *
 * @class      ShowDetail (name)
 * @param      {object}            item    The item
 * @return     {(Array}
 */
function ShowDetail(item) {
    if (LaunchBar.options.commandKey) {
        return dump(item);
    }

    const results = GetImages(item);
    results.unshift({
        title: 'Copy downsized to Clipboard',
        icon: 'font-awesome:fa-copy',
        action: "SetClipboard",
        actionArgument: {
            url: item.images.downsized.url,
            id: item.id
        },
        // actionRunsInBackground: true
        actionReturnsItems: true
    })
    return results;
}

/**
 * Dump an object to LaunchBar output
 *
 * @param      {any}  value   The value
 * @return     {Array}
 */
function dump(value) {
    const items = [];
    if (value && typeof value === 'object') {
        Object.keys(value).forEach((key) => {
            const item = {
                title: key,
                icon: 'font-awesome:info-circle'
            };
            const asdadasd = tryParse(value[key], value[key]);
            if (typeof asdadasd === 'object' && asdadasd) {
                item.badge = Array.isArray(asdadasd) ? `${asdadasd.length} item` : 'Object'
                item.children = dump(asdadasd);
            } else {
                if (asdadasd) {
                    item.label = asdadasd.toString();
                    item.children = [{title: item.label}];
                } else {
                    item.badge = 'null';
                }
            }
            items.push(item);
        })
    }
    return items;
}

/**
 * Try parse a JSON string, or return the fallback value
 *
 * @param      {string}  value     The value
 * @param      {any}     fallback  The fallback
 * @return     {any}
 */
function tryParse(value, fallback) {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch(e) {/**/}
    }
    return fallback;
}

/**
 * Wait for given ms and check if can continue to proform things
 *
 * @param      {number}  [ms=1000]  The milliseconds
 * @return     {boolean}
 */
function throttle(ms = 1000) {
    const FILE = Action.cachePath + 'throttle';
    const time = Date.now();
    File.writeText(time.toString(), FILE);
    while (Date.now() - time < ms) {
        continue;
    }
    return time.toString() === File.readText(
        FILE
    );
}