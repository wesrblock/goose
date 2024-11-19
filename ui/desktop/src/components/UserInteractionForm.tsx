import React, { useState } from 'react'
import { BoxIcon, GPSIcon } from './ui/icons'

interface JsonSchemaProperty {
  type: string
  title?: string
  description?: string
  enum?: string[]
  format?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

interface UserInteractionFormProps {
  schema: {
    type: string
    properties: Record<string, JsonSchemaProperty>
    required?: string[]
  }
  onSubmit?: (formData: Record<string, any>) => void
}

const getIconForSchemaType = (schema: JsonSchemaProperty) => {
  if (schema.enum) return BoxIcon
  if (schema.type === 'integer' || schema.type === 'number') return BoxIcon
  if (schema.format === 'date' || schema.format === 'date-time') return BoxIcon
  return BoxIcon
}

export default function UserInteractionForm({ schema, onSubmit }: UserInteractionFormProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSubmit) {
      onSubmit(formValues)
    }
  }

  const renderSchemaInput = (key: string, schema: JsonSchemaProperty) => {
    const value = formValues[key] || ''
    const Icon = getIconForSchemaType(schema)
    
    if (schema.enum) {
      return (
        <div key={key} className="mb-4">
          <div className="text-white mb-2 flex items-center gap-2">
            <BoxIcon size={16} />
            <span>{schema.title || key}</span>
          </div>
          <div className="flex flex-col space-y-2">
            {schema.enum.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <div
                  className={`cursor-pointer px-3 py-2 rounded-md ${
                    value === option ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                  onClick={() => setFormValues({ ...formValues, [key]: option })}>
                  <span className="text-white">{option}</span>
                </div>
              </div>
            ))}
          </div>
          {schema.description && (
            <div className="text-gray-400 text-sm mt-1">{schema.description}</div>
          )}
        </div>
      )
    }

    return (
      <div key={key} className="w-full mb-4">
        <div className="text-white mb-2 flex items-center gap-2">
          <Icon size={16} />
          <span>{schema.title || key}</span>
        </div>
        {schema.type === 'integer' || schema.type === 'number' ? (
          <input
            type="number"
            className="w-full p-2 bg-gray-700 text-white rounded-md"
            min={schema.minimum}
            max={schema.maximum}
            step={schema.type === 'integer' ? 1 : 0.1}
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
          />
        ) : schema.format === 'date' ? (
          <input
            type="date"
            className="w-full p-2 bg-gray-700 text-white rounded-md"
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
          />
        ) : schema.format === 'date-time' ? (
          <input
            type="datetime-local"
            className="w-full p-2 bg-gray-700 text-white rounded-md"
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
          />
        ) : (
          schema.type === 'string' && (
            !schema.maxLength || schema.maxLength > 100 ? (
              <div
                className="w-full p-2 bg-gray-700 text-white rounded-md min-h-[100px]"
                contentEditable
                onBlur={(e) => setFormValues({ ...formValues, [key]: e.currentTarget.textContent || '' })}
                suppressContentEditableWarning
              />
            ) : (
              <input
                type="text"
                className="w-full p-2 bg-gray-700 text-white rounded-md"
                minLength={schema.minLength}
                maxLength={schema.maxLength}
                value={value}
                onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
              />
            )
          )
        )}
        {schema.description && (
          <div className="text-gray-400 text-sm mt-1">{schema.description}</div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-gray-800 rounded-md">
      {Object.entries(schema.properties).map(([key, propertySchema]) =>
        renderSchemaInput(key, propertySchema as JsonSchemaProperty)
      )}
      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 cursor-pointer inline-flex items-center gap-2"
      >
        <GPSIcon size={14} />
        <span>Submit</span>
      </button>
    </form>
  )
}