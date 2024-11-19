import React, { useState } from 'react'
import { BoxIcon, GPSIcon } from './ui/icons'

interface Plan {
  name: string
  steps: Array<{
    step: number
    description: string
  }>
}

interface ActionOption {
  name: string
  description: string
}

interface Field {
  name: string
  type: 'text' | 'textarea' | 'dropdown' | 'date' | 'number' | 'range'
  label: string
  options?: string[]
  min?: number
  max?: number
  required?: boolean
}

interface Content {
  type: 'text' | 'markdown' | 'link' | 'image'
  value: string
  description?: string
}

type SchemaType = {
  type?: 'PlanApproval' | 'PlanSelection' | 'ActionOptions' | 'InputForm' | 'Presentation'
  plan?: Plan & { confirmationRequired: boolean }
  plans?: Plan[]
  options?: ActionOption[]
  selectionType?: 'single' | 'multiple' | 'reject'
  fields?: Field[]
  content?: Content[]
  status?: string
  waitingForUser?: boolean
}

interface UserInteractionFormProps {
  data: SchemaType
  onSubmit?: (formData: any) => void
}

export default function UserInteractionForm({ data, onSubmit }: UserInteractionFormProps) {
  // Check for status complete and waiting for user
  if (data.status === 'complete' && data.waitingForUser === true) {
    console.log('todo - put notification here')
    return null
  }

  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSubmit) {
      switch (data.type) {
        case 'PlanApproval':
          onSubmit({ approved: formValues.approved })
          break
        case 'PlanSelection':
          onSubmit({ selectedPlan: formValues.selectedPlan })
          break
        case 'ActionOptions':
          onSubmit({ selectedOptions })
          break
        case 'InputForm':
          onSubmit(formValues)
          break
        case 'Presentation':
          onSubmit({ acknowledged: true })
          break
      }
    }
  }

  const renderPlanApproval = () => {
    if (!data.plan) return null
    return (
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">{data.plan.name}</h3>
        <div className="space-y-2">
          {data.plan.steps.map((step) => (
            <div key={step.step} className="text-white">
              {step.step}. {step.description}
            </div>
          ))}
        </div>
        {data.plan.confirmationRequired && (
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => setFormValues({ ...formValues, approved: true })}
              className={`px-4 py-2 rounded-md ${
                formValues.approved === true ? 'bg-green-500' : 'bg-gray-700'
              }`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setFormValues({ ...formValues, approved: false })}
              className={`px-4 py-2 rounded-md ${
                formValues.approved === false ? 'bg-red-500' : 'bg-gray-700'
              }`}
            >
              Reject
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderPlanSelection = () => {
    if (!data.plans) return null
    return (
      <div className="space-y-4">
        {data.plans.map((plan) => (
          <div
            key={plan.name}
            className={`p-4 rounded-md cursor-pointer ${
              formValues.selectedPlan === plan.name ? 'bg-blue-500' : 'bg-gray-700'
            }`}
            onClick={() => setFormValues({ ...formValues, selectedPlan: plan.name })}
          >
            <h3 className="text-white font-semibold">{plan.name}</h3>
            <div className="space-y-2">
              {plan.steps.map((step) => (
                <div key={step.step} className="text-white">
                  {step.step}. {step.description}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderActionOptions = () => {
    if (!data.options) return null
    return (
      <div className="space-y-4">
        {data.options.map((option) => (
          <div
            key={option.name}
            className={`p-4 rounded-md cursor-pointer ${
              selectedOptions.includes(option.name) ? 'bg-blue-500' : 'bg-gray-700'
            }`}
            onClick={() => {
              if (data.selectionType === 'single') {
                setSelectedOptions([option.name])
              } else if (data.selectionType === 'multiple') {
                setSelectedOptions(
                  selectedOptions.includes(option.name)
                    ? selectedOptions.filter((name) => name !== option.name)
                    : [...selectedOptions, option.name]
                )
              }
            }}
          >
            <h3 className="text-white font-semibold">{option.name}</h3>
            <p className="text-gray-300">{option.description}</p>
          </div>
        ))}
        {data.selectionType === 'reject' && (
          <button
            type="button"
            onClick={() => setSelectedOptions([])}
            className="px-4 py-2 bg-red-500 rounded-md text-white"
          >
            Reject All
          </button>
        )}
      </div>
    )
  }

  const renderInputForm = () => {
    if (!data.fields) return null
    return (
      <div className="space-y-4">
        {data.fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <label className="text-white">{field.label}</label>
            {field.type === 'dropdown' ? (
              <select
                className="w-full p-2 bg-gray-700 text-white rounded-md"
                value={formValues[field.name] || ''}
                onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                required={field.required}
              >
                <option value="">Select an option</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                className="w-full p-2 bg-gray-700 text-white rounded-md min-h-[100px]"
                value={formValues[field.name] || ''}
                onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                required={field.required}
              />
            ) : field.type === 'range' ? (
              <input
                type="range"
                className="w-full"
                min={field.min}
                max={field.max}
                value={formValues[field.name] || field.min}
                onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                required={field.required}
              />
            ) : (
              <input
                type={field.type}
                className="w-full p-2 bg-gray-700 text-white rounded-md"
                value={formValues[field.name] || ''}
                onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                min={field.min}
                max={field.max}
                required={field.required}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderPresentation = () => {
    if (!data.content) return null
    return (
      <div className="space-y-4">
        {data.content.map((content, index) => (
          <div key={index} className="text-white">
            {content.type === 'image' ? (
              <div>
                <img src={content.value} alt={content.description} className="max-w-full rounded-md" />
                {content.description && (
                  <p className="text-gray-300 mt-2">{content.description}</p>
                )}
              </div>
            ) : content.type === 'link' ? (
              <a
                href={content.value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                {content.description || content.value}
              </a>
            ) : content.type === 'markdown' ? (
              <div className="prose prose-invert">
                {/* You might want to add a markdown renderer here */}
                {content.value}
              </div>
            ) : (
              <p>{content.value}</p>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-gray-800 rounded-md">
      {data.type === 'PlanApproval' && renderPlanApproval()}
      {data.type === 'PlanSelection' && renderPlanSelection()}
      {data.type === 'ActionOptions' && renderActionOptions()}
      {data.type === 'InputForm' && renderInputForm()}
      {data.type === 'Presentation' && renderPresentation()}
      
      <button
        type="submit"
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 cursor-pointer inline-flex items-center gap-2"
      >
        <GPSIcon size={14} />
        <span>Submit</span>
      </button>
    </form>
  )
}