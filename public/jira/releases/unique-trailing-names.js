function addToCharacterMap(fullName, name, map = {}) {
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
        addToCharacterMap(fullName, name.substr(1), map.characterMap[name[0]])
    }
}

function pruneFrom(rootMap, path, namesToCharacter) {

    while (Object.keys(rootMap.characterMap).length) {
        const character = Object.keys(rootMap.characterMap)[0];
        const childMap = rootMap.characterMap[character];
        if (childMap.followers.length === 1) {
            namesToCharacter[childMap.followers[0]] = character;
            delete rootMap.characterMap[character];
        } else if (childMap.last === true) {
            namesToCharacter[path + character] = character;
            pruneFrom(childMap, path + character, namesToCharacter);
            delete rootMap.characterMap[character];
        } else {
            pruneFrom(childMap, path + character, namesToCharacter);
            delete rootMap.characterMap[character];
        }
    }
}

function characterNamer(names) {
    const root = {
        characterMap: {},
        followers: []
    };
    for (const name of names) {
        addToCharacterMap(name, name, root);
    }
    const namesToCharacter = {};
    pruneFrom(root, "", namesToCharacter);
    return namesToCharacter;
}


export default function uniqueTrailingNames(names) {
    const root = {
        characterMap: {},
        followers: []
    };
    for (const name of names) {
        addToCharacterMap(name, name, root);
    }
    // keep going down the 1 path until you don't have everything
    let current = root;
    let startingWith = "";
    while (Object.keys(current.characterMap).length === 1) {
        let character = Object.keys(current.characterMap)[0];
        startingWith = startingWith + character;
        current = current.characterMap[character];
    }
    if (startingWith.length > 3) {
        return names.map(n => n.replace(startingWith, ""))
    } else {
        return names;
    }

}
