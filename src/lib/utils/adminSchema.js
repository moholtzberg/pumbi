const scalars = new Set(['String', 'Boolean', 'Int', 'Float', 'Decimal', 'BigInt', 'DateTime', 'Json', 'Bytes']);
const secrets = new Set(['password', 'resetPasswordToken', 'tokenHash', 'codeHash', 'sessionKey']);
const labels = { AuctionHouse: 'Auction houses', AuctionSeries: 'Auction series', PlatformPolicy: 'Platform policies', LotWatch: 'Lot watches', User: 'Users', Lot: 'Lots', Auction: 'Auctions', Bid: 'Bids', Invoice: 'Invoices', Shipment: 'Shipments', ContentView: 'Page views' };

export function parseAdminSchema(schema) {
  const blocks = [...schema.matchAll(/^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const enums = new Map(blocks.filter(block => block[1] === 'enum').map(block => [block[2], block[3].split('\n').map(line => line.trim()).filter(line => /^\w+$/.test(line))]));
  const models = blocks.filter(block => block[1] === 'model').map(block => {
    const fields = [], relations = [];
    for (const line of block[3].split('\n')) {
      const match = line.trim().match(/^(\w+)\s+(\w+)(\?|\[\])?(?:\s+(.*))?$/);
      if (!match) continue;
      const [, name, type, modifier, raw = ''] = match;
      const attrs = raw.replace(/\s*\/\/.*$/, '');
      if (!scalars.has(type) && !enums.has(type)) {
        const localFields = attrs.match(/fields:\s*\[([^\]]+)\]/)?.[1].split(',').map(value => value.trim()) || [];
        const references = attrs.match(/references:\s*\[([^\]]+)\]/)?.[1].split(',').map(value => value.trim()) || [];
        if (localFields.length) relations.push({ name, model: type, fields: localFields, references, onDelete: attrs.match(/onDelete:\s*(\w+)/)?.[1] || (modifier === '?' ? 'SetNull' : 'Restrict') });
        continue;
      }
      const defaultMatch = attrs.match(/@default\(("(?:[^"\\]|\\.)*"|[-\d.]+|true|false|\w+)\)/);
      let defaultValue;
      if (defaultMatch) {
        try { defaultValue = JSON.parse(defaultMatch[1]); } catch { defaultValue = defaultMatch[1]; }
      }
      fields.push({
        name, label: name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, text => text.toUpperCase()),
        type, nullable: modifier === '?', list: modifier === '[]', id: /@id\b/.test(attrs),
        generated: /@default\(\w+\(/.test(attrs) || /@updatedAt\b/.test(attrs),
        required: modifier !== '?' && !/@default\(|@updatedAt\b/.test(attrs),
        values: enums.get(type) || null, secret: secrets.has(name),
        ...(defaultValue !== undefined ? { defaultValue } : {})
      });
    }
    for (const relation of relations) {
      relation.fields.forEach((name, index) => {
        const field = fields.find(field => field.name === name);
        if (field) field.reference = { model: relation.model, field: relation.references[index] };
      });
    }
    const key = block[2][0].toLowerCase() + block[2].slice(1);
    return { name: block[2], key, table: block[3].match(/@@map\("([^"]+)"\)/)?.[1] || block[2], label: labels[block[2]] || block[2].replace(/([a-z])([A-Z])/g, '$1 $2') + 's', fields, relations };
  });
  for (const model of models) {
    model.dependents = models.flatMap(child => child.relations.filter(relation => relation.model === model.name).map(relation => ({ model: child.key, label: child.label, relation: relation.name, fields: relation.fields, references: relation.references, onDelete: relation.onDelete })));
    model.columns = [...new Set(['id', ...['title', 'name', 'email', 'lotNumber', 'status', 'role', 'amount', 'totalAmount', 'auctionId', 'auctionHouseId', 'createdAt'].filter(name => fieldsExist(model, name))])].filter(name => fieldsExist(model, name)).slice(0, 7);
  }
  return models;
}
function fieldsExist(model, name) { return model.fields.some(field => field.name === name && !field.secret); }

export function serializeAdminValue(value) {
  if (value == null) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeAdminValue);
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function') return value.toJSON();
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeAdminValue(entry)]));
  }
  return value;
}
