import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class JsonRepository {
    constructor(filename) {
        this.filePath = path.join(__dirname, '..', 'data', filename)
    }

    async readAll() {
        try {
            const data = await fs.readFile(this.filePath, 'utf-8')
            return JSON.parse(data)
        } catch (error) {
            if (error.code === 'ENOENT') {
                await this.writeAll([])
                return []
            }
            throw error
        }
    }

    async writeAll(data) {
        await fs.writeFile(this.filePath, JSON.stringify(data, null, 2))
    }

    async findAll(filter = null) {
        let data = await this.readAll()
        if (filter) {
            data = data.filter(item => {
                return Object.entries(filter).every(([key, value]) => {
                    if (value === undefined || value === null) return true
                    return item[key] === value
                })
            })
        }
        return data
    }

    async findById(id) {
        const data = await this.readAll()
        return data.find(item => item.id === id || item.id === parseInt(id))
    }

    async findOne(filter) {
        const data = await this.readAll()
        return data.find(item => {
            return Object.entries(filter).every(([key, value]) => {
                if (typeof item[key] === 'string' && typeof value === 'string') {
                    return item[key].toLowerCase() === value.toLowerCase()
                }
                return item[key] === value
            })
        })
    }

    async create(item) {
        const data = await this.readAll()
        const maxId = data.reduce((max, i) => Math.max(max, typeof i.id === 'number' ? i.id : 0), 0)
        const newItem = {
            ...item,
            id: typeof item.id === 'string' ? item.id : maxId + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
        data.push(newItem)
        await this.writeAll(data)
        return newItem
    }

    async update(id, updates) {
        const data = await this.readAll()
        const index = data.findIndex(item => item.id === id || item.id === parseInt(id))
        if (index === -1) return null

        data[index] = {
            ...data[index],
            ...updates,
            updatedAt: new Date().toISOString()
        }
        await this.writeAll(data)
        return data[index]
    }

    async delete(id) {
        const data = await this.readAll()
        const index = data.findIndex(item => item.id === id || item.id === parseInt(id))
        if (index === -1) return false

        data.splice(index, 1)
        await this.writeAll(data)
        return true
    }

    async search(query, fields) {
        const data = await this.readAll()
        const lowerQuery = query.toLowerCase()
        return data.filter(item => {
            return fields.some(field => {
                const value = item[field]
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(lowerQuery)
                }
                return false
            })
        })
    }
}
