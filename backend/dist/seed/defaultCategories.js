"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultCategories = seedDefaultCategories;
const models_1 = require("../models");
const DEFAULT_NAMES = ['Polityka', 'Sport', 'Trending'];
/** Ensures baseline categories exist for admin + public filters. */
async function seedDefaultCategories() {
    await Promise.all(DEFAULT_NAMES.map(name => models_1.Category.updateOne({ name }, { $setOnInsert: { name, autoCreated: false } }, { upsert: true })));
}
//# sourceMappingURL=defaultCategories.js.map