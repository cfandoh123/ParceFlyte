import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert } from './ui/alert';
import MatchNegotiationModal from './match-negotiation-modal';
import { MessageSquare, DollarSign, Clock, MapPin, User, Package, Truck } from 'lucide-react';

export default function MatchDetailsCard({ match, onMatchUpdate }) {
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpenNegotiation = () => {
    setIsNegotiationOpen(true);
  };

  const handleCloseNegotiation = () => {
    setIsNegotiationOpen(false);
  };

  const handleMatchAction = () => {
    // Refresh match data or update UI
    onMatchUpdate?.();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'negotiating':
        return 'warning';
      case 'pending':
        return 'secondary';
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'expired':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'negotiating':
        return 'Under Negotiation';
      case 'pending':
        return 'Awaiting Response';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  const isExpired = new Date(match.expiresAt) < new Date();
  const currentFee = match?.negotiation?.proposedFee || match?.negotiation?.initialFee;

  return (
    <>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Match #{match._id}</CardTitle>
              <CardDescription>
                Match Score: {match.matchScore}/100 • {getStatusText(match.status)}
              </CardDescription>
            </div>
            <Badge variant={getStatusColor(match.status)}>
              {match.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Route Information */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">Route Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">From:</span>
                <p className="text-gray-800">{match.agreement?.pickupLocation || 'TBD'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">To:</span>
                <p className="text-gray-800">{match.agreement?.deliveryLocation || 'TBD'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Travel Mode:</span>
                <p className="text-gray-800 capitalize">{match.travel?.travelMode || 'TBD'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Departure:</span>
                <p className="text-gray-800">
                  {match.travel?.departureTime ? new Date(match.travel.departureTime).toLocaleString() : 'TBD'}
                </p>
              </div>
            </div>
          </div>

          {/* Parcel Information */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-green-800">Parcel Information</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Weight:</span>
                <p className="text-gray-800">{match.parcel?.weight}kg</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Value:</span>
                <p className="text-gray-800">${match.parcel?.declaredValue}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Category:</span>
                <p className="text-gray-800 capitalize">{match.parcel?.category}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Deadline:</span>
                <p className="text-gray-800">
                  {match.parcel?.deliveryDeadline ? new Date(match.parcel.deliveryDeadline).toLocaleDateString() : 'TBD'}
                </p>
              </div>
            </div>
          </div>

          {/* Current Offer */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800">Current Offer</h3>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-600">${currentFee}</p>
                <p className="text-xs text-yellow-600">
                  {match.negotiation?.status === 'initial_offer' ? 'Initial offer' : 'Counter-offer'}
                </p>
              </div>
            </div>
            
            <div className="text-sm text-yellow-700">
              <div className="flex justify-between mb-1">
                <span>Fee as % of parcel value:</span>
                <span>{((currentFee / match.parcel?.declaredValue) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Maximum acceptable (15%):</span>
                <span>${(match.parcel?.declaredValue * 0.15).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Expiry Warning */}
          {isExpired && (
            <Alert variant="destructive">
              <Clock className="h-4 w-4" />
              <div>
                <h4 className="font-medium">Match Expired</h4>
                <p className="text-sm">This match has expired and is no longer available for negotiation.</p>
              </div>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!isExpired && match.status === 'negotiating' && (
              <Button 
                onClick={handleOpenNegotiation}
                className="flex-1"
                disabled={loading}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {loading ? 'Loading...' : 'Negotiate Fee'}
              </Button>
            )}
            
            {!isExpired && match.status === 'pending' && (
              <Button 
                onClick={handleOpenNegotiation}
                className="flex-1"
                disabled={loading}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {loading ? 'Loading...' : 'Review & Respond'}
              </Button>
            )}
          </div>

          {/* Match Timeline */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <h4 className="font-medium text-gray-700">Match Timeline</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Proposed:</span>
                <span>{new Date(match.proposedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span>{new Date(match.negotiation?.lastUpdated || match.proposedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Expires:</span>
                <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                  {new Date(match.expiresAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Negotiation Modal */}
      <MatchNegotiationModal
        match={match}
        isOpen={isNegotiationOpen}
        onClose={handleCloseNegotiation}
        onAction={handleMatchAction}
      />
    </>
  );
} 