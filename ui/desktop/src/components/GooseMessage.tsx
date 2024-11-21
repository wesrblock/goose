import React from 'react'
import ToolInvocation from './ToolInvocation'
import ReactMarkdown from 'react-markdown'
import { Button } from './ui/button'

export interface Plan {
  id: string;
  name: string;
  description: string;
}

interface SchemaContent {
  type: 'PlanConfirmation' | 'PlanChoice' | 'ComplexInput';
  plans?: Plan[];
  selectedPlan?: Plan;
  complexInputReason?: string;
}

interface MessageMetadata {
  schemaContent: SchemaContent;
  onPlanSelect?: (plan: Plan) => void;
  onPlanConfirm?: (plan: Plan) => void;
}

interface GooseMessageProps {
  message: any;
  metadata?: MessageMetadata;
}

const PlanDisplay: React.FC<{ plan: Plan }> = ({ plan }) => (
  <div className="border rounded-lg p-4 mb-4">
    <h3 className="font-bold mb-2">{plan.name}</h3>
    <div className="text-sm">{plan.description}</div>
  </div>
);

const SchemaContentDisplay: React.FC<{ content: SchemaContent; onPlanSelect?: (plan: Plan) => void; onPlanConfirm?: (plan: Plan) => void }> = ({ content, onPlanSelect, onPlanConfirm }) => {
  const handleConfirm = () => {
    if (content.selectedPlan && onPlanConfirm) {
      onPlanConfirm(content.selectedPlan);
    }
  };

  const handleCancel = () => {
    console.log('Action cancelled');
  };

  const handlePlanSelect = (plan: Plan) => {
    if (onPlanSelect) {
      onPlanSelect(plan);
    }
  };

  switch (content.type) {
    case 'PlanConfirmation':
      return (
        <div>
          {content.selectedPlan && <PlanDisplay plan={content.selectedPlan} />}
          <div className="flex gap-4 mt-4">
            <Button 
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6"
            >
              Confirm Plan
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCancel}
              className="font-semibold px-6"
            >
              Cancel
            </Button>
          </div>
        </div>
      );

    case 'PlanChoice':
      return (
        <div>
          <div className="mb-4 font-medium text-lg">Select a plan:</div>
          {content.plans?.map((plan) => (
            <div 
              key={plan.id} 
              onClick={() => handlePlanSelect(plan)}
              className="cursor-pointer transition-all duration-200 hover:bg-gray-100 border-2 border-transparent hover:border-blue-500 rounded-lg"
            >
              <PlanDisplay plan={plan} />
            </div>
          ))}
          <div className="flex gap-4 mt-4">
            <Button 
              variant="destructive"
              onClick={handleCancel}
              className="font-semibold px-6"
            >
              Cancel
            </Button>
          </div>
        </div>
      );

    case 'ComplexInput':
      return (
        <div className="text-gray-600 italic bg-gray-50 p-4 rounded-lg border border-gray-200">
          {content.complexInputReason}
        </div>
      );

    default:
      return null;
  }
};

export default function GooseMessage({ message, metadata }: GooseMessageProps) {
  return (
    <div className="flex mb-4">
      <div className="bg-goose-bubble w-full text-black rounded-2xl p-4">
        {message.toolInvocations ? (
          <div className="space-y-4">
            {message.toolInvocations.map((toolInvocation) => (
              <ToolInvocation
                key={toolInvocation.toolCallId}
                toolInvocation={toolInvocation}
              />
            ))}
          </div>
        ) : (
          <div>
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {metadata?.schemaContent && (
              <SchemaContentDisplay 
                content={metadata.schemaContent}
                onPlanSelect={metadata.onPlanSelect}
                onPlanConfirm={metadata.onPlanConfirm}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}