export default function mapIdsToNames(
    obj: { [key: string]: any },
    fields: { idMap: { [key: string]: string } }
) {
    const mapped: { [key: string]: any } = {};
    for (let prop in obj) {
        mapped[fields.idMap[prop] || prop] = obj[prop];
    }
    return mapped;
}
