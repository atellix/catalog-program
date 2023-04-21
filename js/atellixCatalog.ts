export const showProduct = () => {
    console.log('Hello, world!')
}

export interface IImage {
    url: string;
    height?: number;
    width?: number;
    label?: string;
}

export interface IThing {
    id: string | null;
    uuid?: string;
    type: string | null;
    url?: string;
    name: string | null;
    description?: string;
    images: Array<IImage>;
}

export interface IBrand extends IThing {
    slug?: string;
}

export interface IProductAttributeValue extends IThing {
    slug?: string;
    active: boolean;
}

export interface IProductAttribute extends IThing {
    slug?: string;
    values: IProductAttributeValue[];
}

export interface IProduct extends IThing {
    sku?: string;
    slug?: string;
    price?: number;
    priceCurrency?: string;
    brand?: IBrand;
    category?: IThing;
    model?: IThing;
    material?: IThing;
    logo?: IImage;
    size?: string;
    color?: string;
    heigth?: string;
    width?: string;
    depth?: string;
    weight?: string;
    productID?: string;
    releaseDate?: Date;
    countryOfOrigin?: IThing;
    keywords?: Array<string>;
    attributes?: Array<IProductAttribute>;
    variants?: Array<IProduct>;
    offers?: Array<IOffer>;
}

export interface IOffer extends IThing {
    acceptedPaymentMethod?: IThing;
    addOn?: Array<IOffer>;
    advanceBookingRequirement?: string;
    areaServed?: IPlace;
    availability?: string;
    availabilityStarts?: Date;
    availabilityEnds?: Date;
    availabilityAtOrFrom?: IPlace;
    availabilityDeliveryMethod?: IThing;
    businessFunction?: IThing;
    category?: IThing;
    deliveryLeadTime?: string;
    eligibleCustomerType?: IThing;
    eligibleDuration?: string;
    eligibleQuantity?: number;
    eligibleRegion?: Array<IPlace>;
    eligibleTransactionVolume?: string;
    hasAdultConsideration?: boolean;
    inventoryLevel?: number;
    isFamilyFriendly?: boolean;
    itemCondition?: IThing;
    itemOffered?: IProduct;
    leaseLength?: string;
    offeredBy?: IOrganization | IPerson;
    price?: number | null;
    priceCurrency?: string | null;
    priceSpecification?: IThing;
    priceValidUntil?: Date;
    seller?: IOrganization | IPerson;
    serialNumber?: string;
    sku?: string;
    validFrom?: Date;
    validThrough?: Date;
    warranty?: IThing;
}

export interface IOfferCatalog extends IThing {
    numberOfItems: number;
    itemList: Array<IOffer>;
}

export interface IEvent extends IThing {
    name: string;
}

export interface IContactPoint extends IThing {
    areaServed?: IThing;
    contactType?: string;
    email?: string;
    faxNumber?: string;
    hoursAvailable?: IThing;
    productsSupported?: Array<IProduct>;
    telephone?: string;
}

export interface IPostalAddress extends IContactPoint {
    addressCountry?: string;
    addressLocality?: string;
    addressRegion?: string;
    postOfficeBoxNumber?: string;
    postalCode?: string;
    streetAddress?: string;
}

export interface IGeoCoordinates extends IThing {
    address?: IPostalAddress;
    elevation?: string;
    latitude?: string;
    longitude?: string;
}

export interface IPlace extends IThing {
    additionalProperty?: Array<IThing>;
    address?: IPostalAddress;
    branchCode?: string;
    containedInPlace?: IPlace;
    containsPlace?: IPlace;
    event?: Array<IEvent>;
    faxNumber?: string;
    geo?: IGeoCoordinates;
    geoContains?: Array<IPlace>;
    geoCoveredBy?: Array<IPlace>;
    geoCovers?: Array<IPlace>;
    geoCrosses?: Array<IPlace>;
    geoDisjoint?: Array<IPlace>;
    geoEquals?: Array<IPlace>;
    geoIntersects?: Array<IPlace>;
    geoOverlaps?: Array<IPlace>;
    geoTouces?: Array<IPlace>;
    geoWithin?: Array<IPlace>;
    globalLocationNumber?: string;
    hasDriveThroughService?: boolean;
    hasMap?: IPlace;
    isAccessibleForFree?: boolean;
    keywords?: Array<string>;
    latitude?: string | number;
    longitude?: string | number;
    logo?: IImage;
    photo?: IImage;
    publicAccess?: boolean;
    slogan?: string;
    smokingAllowed?: boolean;
    telephone?: string;
    tourBookingPage?: string;
}

export interface IMonetaryAmount extends IThing {
    currency?: string;
    duration?: string;
    minValue?: number;
    maxValue?: number;
    median?: number;
    percentile10?: number;
    percentile25?: number;
    percentile75?: number;
    percentile90?: number;
    validFrom?: Date;
    validThrough?: Date;
    value?: string;
}

export interface IOccupation extends IThing {
    educationRequirements?: IThing;
    estimatedSalary?: Array<IMonetaryAmount>;
    experienceRequirements?: Array<IThing>;
    occupationLocation?: Array<IPlace>;
    occupationalCategory?: Array<IThing>;
    qualifications?: Array<IThing>;
    responsibilities?: Array<IThing>;
    skills?: Array<IThing>;
}

export interface IContact extends IThing {
    address?: IPostalAddress;
    brand?: IBrand;
    email?: string;
    event?: Array<IEvent>;
    faxNumber?: string;
    hasOfferCatalog?: Array<IOfferCatalog>;
    makesOffer?: Array<IOffer>;
    memberOf?: Array<IOrganization>;
    telephone?: string;
    taxID?: string;
    vatID?: string;
}

export interface IPerson extends IContact {
    affiliation?: Array<IOrganization>;
    alumniOf?: Array<IOrganization>;
    award?: Array<IThing>;
    birthDate?: Date;
    birthPlace?: IPlace;
    callSign?: string;
    childern?: Array<IPerson>;
    colleague?: Array<IPerson>;
    familyName?: string;
    follows?: Array<IPerson>;
    gender?: string;
    givenName?: string;
    hasOccupation?: IOccupation;
    height?: string;
    homeLocation?: IPlace;
    honorificPrefix?: string;
    honorificSuffix?: string;
    jobTitle?: string;
    knows?: Array<IPerson>;
    knowsAbout?: Array<IThing>;
    knowsLanguage?: Array<string>;
    owns?: Array<IProduct>;
    relatedTo?: Array<IPerson>;
    seeks?: Array<IThing>;
    sibling?: Array<IPerson>;
    spouse?: Array<IPerson>;
    sponsor?: Array<IOrganization>;
    weight?: string;
    workLocation?: IPlace;
    worksFor?: Array<IOrganization>;
}

export interface IOrganization extends IContact {
    areaServed?: Array<IPlace>;
    contactPoint?: Array<IContactPoint>;
    department?: Array<IOrganization>;
    dissolutionDate?: Date;
    duns?: string;
    employee?: Array<IPerson>;
    founder?: Array<IPerson>;
    foundingDate?: Date;
    foundingLocation?: IPlace;
    funder?: Array<IOrganization>;
    member?: Array<IPerson>;
    location?: IPlace;
    numberOfEmployees?: number;
    parentOrganization?: IOrganization;
    subOrganization?: Array<IOrganization>;
}

/*export interface IJobPosting extends IThing {
    name: string;
}

export interface IResume extends IThing {
    name: string;
}

export interface IToken extends IThing {
    name: string;
}

export interface IInvestmentOffer extends IThing {
    name: string;
}

export interface IPropertyListing extends IThing {
    name: string;
}*/

