import React, { useState, useId } from 'react';
import { Label } from '@atlaskit/form';
import Textfield from '@atlaskit/textfield';
import Button from '@atlaskit/button/new';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';

interface UserDetailsFormProps {
  onSuccess?: () => void;
}

interface UserFormData {
  first: string;
  last: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
}

const UserDetailsForm: React.FC<UserDetailsFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<UserFormData>({ first: '', last: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string>('');

  const firstNameId = useId();
  const lastNameId = useId();

  const isFormValid = formData.first.trim().length > 0 && formData.last.trim().length > 0;

  const handleInputChange = (field: keyof UserFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/user-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first: formData.first.trim(),
          last: formData.last.trim(),
        }),
      });

      const result: ApiResponse = await response.json();

      if (response.ok && result.success) {
        setIsSubmitted(true);
        onSuccess?.();
      } else {
        setError(result.message || 'An error occurred while saving your details.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-sm">
        <SectionMessage appearance="success">
          <h2 className="text-lg font-semibold mb-2">Thank you!</h2>
          <p>Your details have been saved successfully.</p>
        </SectionMessage>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">User Details</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <SectionMessage appearance="error">{error}</SectionMessage>}

        <div>
          <Label htmlFor={firstNameId}>First Name</Label>
          <Textfield
            id={firstNameId}
            name="firstName"
            value={formData.first}
            onChange={(e) => handleInputChange('first', (e.target as HTMLInputElement).value)}
            placeholder="Enter your first name"
            autoComplete="given-name"
            isDisabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor={lastNameId}>Last Name</Label>
          <Textfield
            id={lastNameId}
            name="lastName"
            value={formData.last}
            onChange={(e) => handleInputChange('last', (e.target as HTMLInputElement).value)}
            placeholder="Enter your last name"
            autoComplete="family-name"
            isDisabled={isSubmitting}
          />
        </div>

        <div className="pt-4">
          <Button type="submit" appearance="primary" isDisabled={!isFormValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="small" />
                <span className="ml-2">Submitting...</span>
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UserDetailsForm;
