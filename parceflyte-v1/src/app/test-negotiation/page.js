'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MatchNegotiationModal from '@/components/match-negotiation-modal';
import MatchDetailsCard from '@/components/match-details-card';
import { MessageSquare, DollarSign, Clock, MapPin } from 'lucide-react';

export default function TestNegotiationPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'details'

  // Sample match data
  const sampleMatches = [
    {
      _id: 'match1',
      matchScore: 85,
      status: 'negotiating',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      proposedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      senderId: 'sender123',
      carrierId: 'carrier456',
      parcel: {
        weight: 2.5,
        declaredValue: 150,
        category: 'electronics',
        deliveryDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      travel: {
        travelMode: 'car',
        departureTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        arrivalTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      },
      agreement: {
        pickupLocation: 'San Francisco, CA',
        deliveryLocation: 'Los Angeles, CA',
      },
      negotiation: {
        initialFee: 45,
        proposedFee: 35,
        status: 'counter_offered',
        lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    },
    {
      _id: 'match2',
      matchScore: 92,
      status: 'pending',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      proposedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      senderId: 'sender123',
      carrierId: 'carrier789',
      parcel: {
        weight: 1.0,
        declaredValue: 200,
        category: 'documents',
        deliveryDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      travel: {
        travelMode: 'train',
        departureTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        arrivalTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      },
      agreement: {
        pickupLocation: 'New York, NY',
        deliveryLocation: 'Boston, MA',
      },
      negotiation: {
        initialFee: 25,
        proposedFee: 25,
        status: 'initial_offer',
        lastUpdated: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
    },
  ];

  const handleOpenNegotiation = (match) => {
    setSelectedMatch(match);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedMatch(null);
  };

  const handleAction = () => {
    // Handle successful action (e.g., refresh matches)
    console.log('Match action completed');
  };

  const handleMatchUpdate = () => {
    // Refresh match data
    console.log('Match updated');
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
      default:
        return 'secondary';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Match Negotiation Test</h1>
        <p className="text-gray-600">
          Test the negotiation modal with sample match data. Click on any match to start negotiating.
        </p>
        
        {/* View Mode Toggle */}
        <div className="flex gap-2 mt-4">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            List View
          </Button>
          <Button
            variant={viewMode === 'details' ? 'default' : 'outline'}
            onClick={() => setViewMode('details')}
          >
            Details View
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="grid gap-6 md:grid-cols-2">
          {sampleMatches.map((match) => (
            <Card key={match._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Match #{match._id}</CardTitle>
                  <Badge variant={getStatusColor(match.status)}>
                    {match.status}
                  </Badge>
                </div>
                <CardDescription>
                  Match Score: {match.matchScore}/100
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Route Info */}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>
                    {match.agreement.pickupLocation} → {match.agreement.deliveryLocation}
                  </span>
                </div>

                {/* Parcel Info */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span>Weight:</span>
                    <span className="font-medium">{match.parcel.weight}kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Value:</span>
                    <span className="font-medium">${match.parcel.declaredValue}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Category:</span>
                    <span className="font-medium capitalize">{match.parcel.category}</span>
                  </div>
                </div>

                {/* Current Offer */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Current Offer</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      ${match.negotiation.proposedFee}
                    </span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {match.negotiation.status === 'initial_offer' ? 'Initial offer' : 'Counter-offer'}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleOpenNegotiation(match)}
                    className="flex-1"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Negotiate
                  </Button>
                </div>

                {/* Expiry Info */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>
                    Expires: {new Date(match.expiresAt).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {sampleMatches.map((match) => (
            <MatchDetailsCard
              key={match._id}
              match={match}
              onMatchUpdate={handleMatchUpdate}
            />
          ))}
        </div>
      )}

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>1. Toggle between "List View" and "Details View" to see different layouts</p>
            <p>2. Click "Negotiate" on any match to open the negotiation modal</p>
            <p>3. Navigate through the steps using "Next" and "Previous" buttons</p>
            <p>4. In the "Propose Counter-Offer" step, enter a fee and message</p>
            <p>5. View the negotiation history in the final step</p>
            <p>6. Accept the current offer from the "Current Offer" step</p>
          </div>
        </CardContent>
      </Card>

      {/* Negotiation Modal */}
      <MatchNegotiationModal
        match={selectedMatch}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onAction={handleAction}
      />
    </div>
  );
} 