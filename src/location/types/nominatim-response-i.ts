//Using Nominatim to resolve All valid location details from HQ
export interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    state?: string;
    country?: string;
  };
}
