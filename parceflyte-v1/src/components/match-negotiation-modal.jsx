import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert } from './ui/alert';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { CheckCircle, Circle, DollarSign, MessageSquare, Clock, TrendingUp } from 'lucide-react';

export default function MatchNegotiationModal({ match, isOpen, onClose, onAction }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [negotiationHistory, setNegotiationHistory] = useState([]);
  const [proposedFee, setProposedFee] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    {
      id: 'match-details',
      title: 'Match Details',
      description: 'Review the match and current offer',
      icon: CheckCircle,
    },
    {
      id: 'current-offer',
      title: 'Current Offer',
      description: 'View the current delivery fee',
      icon: DollarSign,
    },
    {
      id: 'propose-counter',
      title: 'Propose Counter-Offer',
      description: 'Make your counter-proposal',
      icon: TrendingUp,
    },
    {
      id: 'negotiation-history',
      title: 'Negotiation History',
      description: 'View all offers and messages',
      icon: MessageSquare,
    }
  ];

  useEffect(() => {
    if (isOpen && match) {
      setCurrentStep(0);
      fetchNegotiationHistory();
    }
  }, [isOpen, match]);

  const fetchNegotiationHistory = async () => {
    if (!match?._id) return;
    
    try {
      const res = await fetch(`/api/matches/${match._id}/negotiate`);
      const data = await res.json();
      if (res.ok) {
        setNegotiationHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch negotiation history:', error);
    }
  };

  const handleProposeFee = async () => {
    if (!proposedFee || !match?._id) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/matches/${match._id}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedFee: parseFloat(proposedFee),
          proposedBy: match.senderId,
          message: message,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to propose fee');

      // Refresh negotiation history
      await fetchNegotiationHistory();
      setCurrentStep(3); // Go to history
      setProposedFee('');
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptMatch = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/matches/${match._id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negotiation: {
            finalFee: match.negotiation?.proposedFee || match.negotiation?.initialFee,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept match');

      onAction?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <MatchDetailsStep match={match} />;
      case 1:
        return <CurrentOfferStep match={match} />;
      case 2:
        return (
          <ProposeCounterStep
            match={match}
            proposedFee={proposedFee}
            setProposedFee={setProposedFee}
            message={message}
            setMessage={setMessage}
            loading={loading}
            error={error}
            onPropose={handleProposeFee}
          />
        );
      case 3:
        return <NegotiationHistoryStep history={negotiationHistory} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Negotiate Delivery Fee</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.title}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper Progress */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 mr-2">
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : isCurrent ? (
                    <Icon className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium">
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {step.description}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden sm:block w-16 h-0.5 bg-gray-200 mx-4" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          <div className="flex gap-2">
            {currentStep === 1 && (
              <Button onClick={handleAcceptMatch} disabled={loading}>
                {loading ? 'Accepting...' : 'Accept Offer'}
              </Button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={currentStep === 0 && !match}
              >
                Next
              </Button>
            ) : (
              <Button onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Match Details Step
function MatchDetailsStep({ match }) {
  if (!match) return null;

  return (
    <div className="space-y-4">
      <DialogDescription>
        Review the match details and carrier information before negotiating the delivery fee.
      </DialogDescription>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Match Information</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="font-medium">Match Score:</span> {match.matchScore}/100</div>
          <div><span className="font-medium">Status:</span> 
            <Badge variant="secondary" className="ml-1">{match.status}</Badge>
          </div>
          <div><span className="font-medium">Expires:</span> {new Date(match.expiresAt).toLocaleString()}</div>
          <div><span className="font-medium">Proposed:</span> {new Date(match.proposedAt).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Route Details</h3>
        <div className="text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">From:</span> {match.agreement?.pickupLocation || 'TBD'}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">To:</span> {match.agreement?.deliveryLocation || 'TBD'}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Travel Mode:</span> {match.travel?.travelMode || 'TBD'}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Parcel Information</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="font-medium">Weight:</span> {match.parcel?.weight}kg</div>
          <div><span className="font-medium">Value:</span> ${match.parcel?.declaredValue}</div>
          <div><span className="font-medium">Category:</span> {match.parcel?.category}</div>
          <div><span className="font-medium">Deadline:</span> {new Date(match.parcel?.deliveryDeadline).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}

// Current Offer Step
function CurrentOfferStep({ match }) {
  const currentFee = match?.negotiation?.proposedFee || match?.negotiation?.initialFee;
  const maxFee = match?.parcel?.declaredValue * 0.15; // 15% of parcel value

  return (
    <div className="space-y-4">
      <DialogDescription>
        Review the current delivery fee offer from the carrier.
      </DialogDescription>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-800">Current Offer</h3>
            <p className="text-2xl font-bold text-blue-600">${currentFee}</p>
            <p className="text-sm text-blue-600">Delivery fee proposed by carrier</p>
          </div>
          <DollarSign className="w-8 h-8 text-blue-600" />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Fee Analysis</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Parcel Value:</span>
            <span>${match?.parcel?.declaredValue}</span>
          </div>
          <div className="flex justify-between">
            <span>Current Fee:</span>
            <span>${currentFee}</span>
          </div>
          <div className="flex justify-between">
            <span>Fee as % of Value:</span>
            <span>{((currentFee / match?.parcel?.declaredValue) * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Maximum Acceptable:</span>
            <span>${maxFee}</span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">Your Options</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Accept the current offer</li>
          <li>• Propose a lower counter-offer</li>
          <li>• Wait for the carrier to adjust their offer</li>
        </ul>
      </div>
    </div>
  );
}

// Propose Counter Step
function ProposeCounterStep({ match, proposedFee, setProposedFee, message, setMessage, loading, error, onPropose }) {
  const currentFee = match?.negotiation?.proposedFee || match?.negotiation?.initialFee;
  const maxFee = match?.parcel?.declaredValue * 0.15;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!proposedFee) return;
    
    const fee = parseFloat(proposedFee);
    if (fee > maxFee) {
      alert(`Fee cannot exceed $${maxFee} (15% of parcel value)`);
      return;
    }
    
    onPropose();
  };

  return (
    <div className="space-y-4">
      <DialogDescription>
        Propose a counter-offer for the delivery fee. Make sure your offer is reasonable and competitive.
      </DialogDescription>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="proposedFee">Proposed Delivery Fee ($)</Label>
          <Input
            id="proposedFee"
            type="number"
            step="0.01"
            min="0"
            max={maxFee}
            value={proposedFee}
            onChange={(e) => setProposedFee(e.target.value)}
            placeholder={`Enter amount (max: $${maxFee})`}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum acceptable fee: ${maxFee} (15% of parcel value)
          </p>
        </div>

        <div>
          <Label htmlFor="message">Message (Optional)</Label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message to explain your counter-offer..."
            className="w-full border rounded px-3 py-2 mt-1"
            rows={3}
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Offer Comparison</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Current Offer:</span>
              <span className="font-medium">${currentFee}</span>
            </div>
            <div className="flex justify-between">
              <span>Your Proposal:</span>
              <span className="font-medium">${proposedFee || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span>Difference:</span>
              <span className={proposedFee ? (parseFloat(proposedFee) < currentFee ? 'text-green-600' : 'text-red-600') : ''}>
                ${proposedFee ? (parseFloat(proposedFee) - currentFee).toFixed(2) : '0'}
              </span>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={!proposedFee || loading} className="w-full">
          {loading ? 'Submitting...' : 'Submit Counter-Offer'}
        </Button>
      </form>
    </div>
  );
}

// Negotiation History Step
function NegotiationHistoryStep({ history }) {
  return (
    <div className="space-y-4">
      <DialogDescription>
        View the complete negotiation history and all offers made.
      </DialogDescription>
      
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No negotiation history yet.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-semibold">${entry.amount}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                Proposed by: {entry.proposedBy === 'sender' ? 'You' : 'Carrier'}
              </div>
              
              {entry.message && (
                <div className="bg-gray-50 rounded p-2 text-sm">
                  <span className="font-medium">Message:</span> {entry.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Negotiation Tips</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Be reasonable with your counter-offers</li>
          <li>• Consider the carrier's travel costs and time</li>
          <li>• Include a message to explain your reasoning</li>
          <li>• Remember that both parties need to agree</li>
        </ul>
      </div>
    </div>
  );
} 