function addToCharacterMap(fullName, name, map) {
    if (map === void 0) { map = {}; }
    if (name === "") {
        map.last = true;
    }
    map.followers.push(fullName);
    if (!map.characterMap[name[0]]) {
        map.characterMap[name[0]] = {
            followers: [],
            characterMap: {}
        };
    }
    if (name !== "") {
        addToCharacterMap(fullName, name.substr(1), map.characterMap[name[0]]);
    }
}
function pruneFrom(rootMap, path, namesToCharacter) {
    while (Object.keys(rootMap.characterMap).length) {
        var character = Object.keys(rootMap.characterMap)[0];
        var childMap = rootMap.characterMap[character];
        if (childMap.followers.length === 1) {
            namesToCharacter[childMap.followers[0]] = character;
            delete rootMap.characterMap[character];
        }
        else if (childMap.last === true) {
            namesToCharacter[path + character] = character;
            pruneFrom(childMap, path + character, namesToCharacter);
            delete rootMap.characterMap[character];
        }
        else {
            pruneFrom(childMap, path + character, namesToCharacter);
            delete rootMap.characterMap[character];
        }
    }
}
function characterNamer(names) {
    var root = {
        characterMap: {},
        followers: []
    };
    for (var _i = 0, names_1 = names; _i < names_1.length; _i++) {
        var name_1 = names_1[_i];
        addToCharacterMap(name_1, name_1, root);
    }
    var namesToCharacter = {};
    pruneFrom(root, "", namesToCharacter);
    return namesToCharacter;
}
export default function uniqueTrailingNames(names) {
    var root = {
        characterMap: {},
        followers: []
    };
    for (var _i = 0, names_2 = names; _i < names_2.length; _i++) {
        var name_2 = names_2[_i];
        addToCharacterMap(name_2, name_2, root);
    }
    // keep going down the 1 path until you don't have everything
    var current = root;
    var startingWith = "";
    while (Object.keys(current.characterMap).length === 1) {
        var character = Object.keys(current.characterMap)[0];
        startingWith = startingWith + character;
        current = current.characterMap[character];
    }
    if (startingWith.length > 3) {
        return names.map(function (n) { return n.replace(startingWith, ""); });
    }
    else {
        return names;
    }
}
