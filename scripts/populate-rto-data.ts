#!/usr/bin/env bun
/**
 * RTO Data Population Script
 * 
 * Fetches RTO data from Wikipedia and uses Gemini with structured output to enrich, 
 * validate, and create complete JSON files for RTOs. This combines data fetching + 
 * validation + fixing in a single workflow.
 * 
 * Data Flow:
 *   1. Fetch state RTO table from Wikipedia
 *   2. Parse the table for basic code/location data
 *   3. Use Gemini to enrich with district, jurisdiction, description, etc.
 *   4. Validate the enriched data with Zod
 *   5. Save complete JSON files
 * 
 * Usage:
 *   bun scripts/populate-rto-data.ts <state-code> [options]
 *   bun scripts/populate-rto-data.ts <state-code> <start> <end> [options]
 * 
 * Examples:
 *   bun scripts/populate-rto-data.ts ga                    # All Goa RTOs
 *   bun scripts/populate-rto-data.ts ka 1 10               # Karnataka RTOs 1-10
 *   bun scripts/populate-rto-data.ts ga --dry-run          # Preview without saving
 *   bun scripts/populate-rto-data.ts ka 55 --verbose       # Single RTO with details
 *   bun scripts/populate-rto-data.ts tn --skip-existing    # Skip already populated files
 *   bun scripts/populate-rto-data.ts kl 49 --search        # Use Google Search for accuracy
 * 
 * Options:
 *   --dry-run          Preview without writing files
 *   --skip-existing    Skip RTOs that already have JSON files
 *   --search           Use Google Search grounding for better accuracy (recommended)
 *   --verbose, -v      Show detailed output
 *   --force            Overwrite existing files
 *   --help, -h         Show help
 * 
 * Environment Variables:
 *   GEMINI_API_KEY     Your Google Gemini API key (required)
 */

import { GoogleGenAI } from '@google/genai';
import { z, toJSONSchema } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Helper to convert Zod schema to Gemini-compatible JSON schema
// Removes $schema and additionalProperties fields that Gemini API doesn't accept
function toGeminiSchema(schema: z.ZodType): object {
    const jsonSchema = toJSONSchema(schema) as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, additionalProperties, ...rest } = jsonSchema;
    return rest;
}

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-3-flash-preview';
const API_DELAY_MS = 1500;

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

// ============================================================================
// Zod Schemas
// ============================================================================

const RTODataSchema = z.object({
    code: z.string().describe('RTO code like KA-01, KL-49'),
    region: z.string().describe('Region/area name this RTO serves'),
    city: z.string().describe('City name'),
    state: z.string().describe('Full state name'),
    stateCode: z.string().describe('2-letter state code'),
    district: z.string().describe('District name'),
    division: z.string().describe('Transport division name'),
    description: z.string().describe('2-3 sentence description of this RTO, its coverage area, and significance'),
    status: z.enum(['active', 'not-in-use']).default('active').describe('Status: active or not-in-use'),
    established: z.string().describe('Year established or N/A'),
    address: z.string().describe('Full address of the RTO office'),
    pinCode: z.string().describe('6-digit PIN code or empty string if unknown'),
    phone: z.string().describe('Phone number or N/A'),
    email: z.string().describe('Email or N/A'),
    jurisdictionAreas: z.array(z.string()).describe('Array of talukas, mandals, or areas under this RTO jurisdiction'),
});

type RTOData = z.infer<typeof RTODataSchema>;

// ============================================================================
// State Configurations
// ============================================================================

interface StateInfo {
    name: string;
    code: string;
    folder: string;
    capital: string;
    wikipediaTitle: string;
    totalRTOs: number;
    districts: string[];
}

const STATE_CONFIG: Record<string, StateInfo> = {
    'ka': {
        name: 'Karnataka',
        code: 'KA',
        folder: 'karnataka',
        capital: 'Bengaluru',
        wikipediaTitle: 'List of RTOs in Karnataka',
        totalRTOs: 71,
        districts: [
            'Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban',
            'Bidar', 'Chamarajanagar', 'Chikkaballapura', 'Chikkamagaluru', 'Chitradurga',
            'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri',
            'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur',
            'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada',
            'Vijayanagara', 'Vijayapura', 'Yadgir'
        ]
    },
    'ga': {
        name: 'Goa',
        code: 'GA',
        folder: 'goa',
        capital: 'Panaji',
        wikipediaTitle: 'List of RTOs in Goa',
        totalRTOs: 12,
        districts: ['North Goa', 'South Goa']
    },
    'tn': {
        name: 'Tamil Nadu',
        code: 'TN',
        folder: 'tamil-nadu',
        capital: 'Chennai',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 143,
        districts: [
            'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
            'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram',
            'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
            'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai',
            'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
            'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
            'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur',
            'Vellore', 'Viluppuram', 'Virudhunagar'
        ]
    },
    'mh': {
        name: 'Maharashtra',
        code: 'MH',
        folder: 'maharashtra',
        capital: 'Mumbai',
        wikipediaTitle: 'List of RTOs in Maharashtra',
        totalRTOs: 53,
        districts: [
            'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara',
            'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli',
            'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban',
            'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani',
            'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur',
            'Thane', 'Wardha', 'Washim', 'Yavatmal'
        ]
    },
    'ap': {
        name: 'Andhra Pradesh',
        code: 'AP',
        folder: 'andhra-pradesh',
        capital: 'Amaravati',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 40,
        districts: [
            'Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool',
            'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram',
            'West Godavari', 'YSR Kadapa'
        ]
    },
    'ts': {
        name: 'Telangana',
        code: 'TS',
        folder: 'telangana',
        capital: 'Hyderabad',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 38,
        districts: [
            'Adilabad', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahabubnagar',
            'Medak', 'Nalgonda', 'Nizamabad', 'Rangareddy', 'Warangal'
        ]
    },
    'kl': {
        name: 'Kerala',
        code: 'KL',
        folder: 'kerala',
        capital: 'Thiruvananthapuram',
        wikipediaTitle: 'List of RTOs in Kerala',
        totalRTOs: 87,
        districts: [
            'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam',
            'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta',
            'Thiruvananthapuram', 'Thrissur', 'Wayanad'
        ]
    },
    'dl': {
        name: 'Delhi',
        code: 'DL',
        folder: 'delhi',
        capital: 'New Delhi',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 16,
        districts: [
            'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi',
            'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi',
            'South West Delhi', 'West Delhi'
        ]
    },
    'gj': {
        name: 'Gujarat',
        code: 'GJ',
        folder: 'gujarat',
        capital: 'Gandhinagar',
        wikipediaTitle: 'List of RTOs in Gujarat',
        totalRTOs: 37,
        districts: [
            'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
            'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
            'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
            'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
            'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
            'Tapi', 'Vadodara', 'Valsad'
        ]
    },
    'an': {
        name: 'Andaman and Nicobar Islands',
        code: 'AN',
        folder: 'andaman-nicobar',
        capital: 'Port Blair',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 3,
        districts: ['South Andaman', 'North and Middle Andaman', 'Nicobar']
    },
    'ar': {
        name: 'Arunachal Pradesh',
        code: 'AR',
        folder: 'arunachal-pradesh',
        capital: 'Itanagar',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 22,
        districts: [
            'Papum Pare', 'Tawang', 'West Kameng', 'East Kameng', 'Lower Subansiri',
            'Upper Subansiri', 'West Siang', 'East Siang', 'Dibang Valley', 'Lohit',
            'Changlang', 'Tirap', 'Kurung Kumey', 'Anjaw', 'Lower Dibang Valley',
            'Longding', 'Namsai', 'Kra Daadi', 'Siang', 'Lower Siang'
        ]
    },
    'as': {
        name: 'Assam',
        code: 'AS',
        folder: 'assam',
        capital: 'Dispur',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 34,
        districts: [
            'Kamrup Metropolitan', 'Nagaon', 'Jorhat', 'Sivasagar', 'Golaghat',
            'Dibrugarh', 'Lakhimpur', 'Dima Hasao', 'Karbi Anglong', 'Karimganj',
            'Cachar', 'Sonitpur', 'Darrang', 'Nalbari', 'Barpeta', 'Kokrajhar',
            'Dhubri', 'Goalpara', 'Bongaigaon', 'Morigaon', 'Dhemaji', 'Tinsukia',
            'Hailakandi', 'Kamrup', 'Chirang', 'Udalguri', 'Majuli', 'Hojai',
            'Biswanath', 'Charaideo', 'South Salmara-Mankachar'
        ]
    },
    'br': {
        name: 'Bihar',
        code: 'BR',
        folder: 'bihar',
        capital: 'Patna',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 56,
        districts: [
            'Patna', 'Gaya', 'Bhojpur', 'Saran', 'East Champaran', 'Muzaffarpur',
            'Darbhanga', 'Munger', 'Begusarai', 'Bhagalpur', 'Purnia', 'Saharsa',
            'Nalanda', 'West Champaran', 'Rohtas', 'Jehanabad', 'Aurangabad',
            'Nawada', 'Gopalganj', 'Siwan', 'Sitamarhi', 'Vaishali', 'Madhubani',
            'Samastipur', 'Khagaria', 'Kishanganj', 'Araria', 'Katihar', 'Madhepura',
            'Buxar', 'Kaimur', 'Jamui', 'Supaul', 'Banka', 'Sheikhpura',
            'Lakhisarai', 'Sheohar', 'Arwal'
        ]
    },
    'ch': {
        name: 'Chandigarh',
        code: 'CH',
        folder: 'chandigarh',
        capital: 'Chandigarh',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 4,
        districts: ['Chandigarh']
    },
    'cg': {
        name: 'Chhattisgarh',
        code: 'CG',
        folder: 'chhattisgarh',
        capital: 'Raipur',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 30,
        districts: [
            'Raipur', 'Dhamtari', 'Mahasamund', 'Durg', 'Rajnandgaon', 'Kabirdham',
            'Bilaspur', 'Janjgir-Champa', 'Korba', 'Raigarh', 'Jashpur', 'Surguja',
            'Koriya', 'Bastar', 'Dantewada', 'Kanker', 'Bijapur', 'Narayanpur',
            'Baloda Bazar', 'Gariaband', 'Balod', 'Bemetara', 'Sukma', 'Kondagaon',
            'Mungeli', 'Surajpur', 'Balrampur', 'Gaurela-Pendra-Marwahi'
        ]
    },
    'dd': {
        name: 'Dadra and Nagar Haveli and Daman and Diu',
        code: 'DD',
        folder: 'dadra-nagar-haveli-daman-diu',
        capital: 'Daman',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 3,
        districts: ['Dadra and Nagar Haveli', 'Daman', 'Diu']
    },
    'hr': {
        name: 'Haryana',
        code: 'HR',
        folder: 'haryana',
        capital: 'Chandigarh',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 99,
        districts: [
            'Ambala', 'Yamunanagar', 'Panchkula', 'Karnal', 'Panipat', 'Kurukshetra',
            'Kaithal', 'Sonipat', 'Rohtak', 'Jhajjar', 'Bhiwani', 'Charkhi Dadri',
            'Hisar', 'Fatehabad', 'Sirsa', 'Gurugram', 'Nuh', 'Faridabad', 'Palwal',
            'Jind', 'Mahendragarh', 'Rewari'
        ]
    },
    'hp': {
        name: 'Himachal Pradesh',
        code: 'HP',
        folder: 'himachal-pradesh',
        capital: 'Shimla',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 99,
        districts: [
            'Shimla', 'Kangra', 'Mandi', 'Solan', 'Sirmaur', 'Una', 'Hamirpur',
            'Bilaspur', 'Kullu', 'Chamba', 'Kinnaur', 'Lahaul and Spiti'
        ]
    },
    'jk': {
        name: 'Jammu and Kashmir',
        code: 'JK',
        folder: 'jammu-kashmir',
        capital: 'Srinagar',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 22,
        districts: [
            'Srinagar', 'Jammu', 'Anantnag', 'Budgam', 'Baramulla', 'Doda',
            'Kathua', 'Kupwara', 'Rajouri', 'Poonch', 'Pulwama', 'Udhampur',
            'Bandipora', 'Ganderbal', 'Kishtwar', 'Kulgam', 'Ramban', 'Reasi',
            'Samba', 'Shopian'
        ]
    },
    'jh': {
        name: 'Jharkhand',
        code: 'JH',
        folder: 'jharkhand',
        capital: 'Ranchi',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 24,
        districts: [
            'Ranchi', 'Hazaribagh', 'Palamu', 'Dumka', 'East Singhbhum',
            'West Singhbhum', 'Gumla', 'Lohardaga', 'Bokaro', 'Dhanbad', 'Giridih',
            'Koderma', 'Chatra', 'Garhwa', 'Deoghar', 'Pakur', 'Godda', 'Sahebganj',
            'Latehar', 'Simdega', 'Jamtara', 'Seraikela Kharsawan', 'Khunti', 'Ramgarh'
        ]
    },
    'la': {
        name: 'Ladakh',
        code: 'LA',
        folder: 'ladakh',
        capital: 'Leh',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 2,
        districts: ['Kargil', 'Leh']
    },
    'ld': {
        name: 'Lakshadweep',
        code: 'LD',
        folder: 'lakshadweep',
        capital: 'Kavaratti',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 9,
        districts: ['Kavaratti', 'Agatti', 'Amini', 'Androth', 'Kadmat', 'Kiltan', 'Kalpeni', 'Minicoy']
    },
    'mp': {
        name: 'Madhya Pradesh',
        code: 'MP',
        folder: 'madhya-pradesh',
        capital: 'Bhopal',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 74,
        districts: [
            'Bhopal', 'Hoshangabad', 'Morena', 'Gwalior', 'Guna', 'Indore',
            'Khargone', 'Dhar', 'Khandwa', 'Ujjain', 'Mandsaur', 'Sagar', 'Chhatarpur',
            'Rewa', 'Shahdol', 'Satna', 'Jabalpur', 'Katni', 'Seoni', 'Chhindwara',
            'Bhind', 'Sheopur', 'Datia', 'Shivpuri', 'Damoh', 'Panna', 'Tikamgarh',
            'Sehore', 'Raisen', 'Rajgarh', 'Vidisha', 'Dewas', 'Shajapur', 'Ratlam',
            'Neemuch', 'Jhabua', 'Barwani', 'Harda', 'Betul', 'Narsinghpur',
            'Balaghat', 'Mandla', 'Dindori', 'Sidhi', 'Umaria', 'Anuppur', 'Singrauli',
            'Ashoknagar', 'Burhanpur', 'Alirajpur', 'Agar Malwa', 'Niwari', 'Mauganj',
            'Maihar', 'Pandhurna'
        ]
    },
    'mn': {
        name: 'Manipur',
        code: 'MN',
        folder: 'manipur',
        capital: 'Imphal',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 8,
        districts: [
            'Imphal West', 'Churachandpur', 'Kangpokpi', 'Thoubal', 'Bishnupur',
            'Senapati', 'Ukhrul', 'Chandel', 'Tamenglong', 'Jiribam', 'Kakching',
            'Kamjong', 'Noney', 'Pherzawl', 'Tengnoupal'
        ]
    },
    'ml': {
        name: 'Meghalaya',
        code: 'ML',
        folder: 'meghalaya',
        capital: 'Shillong',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 10,
        districts: [
            'East Jaintia Hills', 'West Jaintia Hills', 'East Khasi Hills',
            'West Khasi Hills', 'South West Khasi Hills', 'Ri-Bhoi',
            'North Garo Hills', 'East Garo Hills', 'West Garo Hills',
            'South West Garo Hills', 'South Garo Hills'
        ]
    },
    'mz': {
        name: 'Mizoram',
        code: 'MZ',
        folder: 'mizoram',
        capital: 'Aizawl',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 8,
        districts: [
            'Aizawl', 'Lunglei', 'Saiha', 'Champhai', 'Kolasib', 'Serchhip',
            'Lawngtlai', 'Mamit'
        ]
    },
    'nl': {
        name: 'Nagaland',
        code: 'NL',
        folder: 'nagaland',
        capital: 'Kohima',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 10,
        districts: [
            'Kohima', 'Mokokchung', 'Tuensang', 'Mon', 'Wokha', 'Zunheboto',
            'Dimapur', 'Phek', 'Peren', 'Kiphire', 'Longleng'
        ]
    },
    'od': {
        name: 'Odisha',
        code: 'OD',
        folder: 'odisha',
        capital: 'Bhubaneswar',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 35,
        districts: [
            'Balasore', 'Khurda', 'Bolangir', 'Jajpur', 'Cuttack', 'Dhenkanal',
            'Ganjam', 'Kalahandi', 'Keonjhar', 'Koraput', 'Mayurbhanj', 'Khandhamal',
            'Puri', 'Sundargarh', 'Sambalpur', 'Bargarh', 'Rayagada', 'Angul',
            'Gajapati', 'Jagatsinghpur', 'Bhadrak', 'Jharsuguda', 'Nabarangpur',
            'Nayagarh', 'Nuapada', 'Boudh', 'Debagarh', 'Kendrapara', 'Malkangiri',
            'Subarnapur'
        ]
    },
    'py': {
        name: 'Puducherry',
        code: 'PY',
        folder: 'puducherry',
        capital: 'Puducherry',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 5,
        districts: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam']
    },
    'pb': {
        name: 'Punjab',
        code: 'PB',
        folder: 'punjab',
        capital: 'Chandigarh',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 99,
        districts: [
            'Amritsar', 'Bathinda', 'Faridkot', 'Ferozpur', 'Gurdaspur', 'Hoshiarpur',
            'Jalandhar', 'Kapurthala', 'Ludhiana', 'Patiala', 'Rupnagar', 'Sangrur',
            'Fazilka', 'Fatehgarh Sahib', 'Moga', 'Muktsar', 'Mansa', 'Nawanshahar',
            'Pathankot', 'Tarn Taran', 'Mohali', 'Barnala', 'Malerkotla'
        ]
    },
    'rj': {
        name: 'Rajasthan',
        code: 'RJ',
        folder: 'rajasthan',
        capital: 'Jaipur',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 60,
        districts: [
            'Ajmer', 'Alwar', 'Banswara', 'Barmer', 'Bharatpur', 'Bhilwara',
            'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dholpur', 'Dungarpur',
            'Sri Ganganagar', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu',
            'Jodhpur', 'Kota', 'Nagaur', 'Pali', 'Sikar', 'Sirohi', 'Sawai Madhopur',
            'Tonk', 'Udaipur', 'Baran', 'Dausa', 'Rajsamand', 'Hanumangarh',
            'Kotputli-Behror', 'Karauli', 'Pratapgarh', 'Didwana-Kuchaman', 'Balotra',
            'Khairthal-Tijara', 'Phalodi', 'Salumbar', 'Kekri', 'Gangapur'
        ]
    },
    'sk': {
        name: 'Sikkim',
        code: 'SK',
        folder: 'sikkim',
        capital: 'Gangtok',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 8,
        districts: ['Gangtok', 'Gyalshing', 'pakyong', 'Namchi', 'Soreng', 'Mangan']
    },
    'tr': {
        name: 'Tripura',
        code: 'TR',
        folder: 'tripura',
        capital: 'Agartala',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 8,
        districts: [
            'West Tripura', 'Unakoti', 'Gomati', 'Dhalai', 'North Tripura', 'Khowai',
            'Sipahijala', 'South Tripura'
        ]
    },
    'up': {
        name: 'Uttar Pradesh',
        code: 'UP',
        folder: 'uttar-pradesh',
        capital: 'Lucknow',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 96,
        districts: [
            'Saharanpur', 'Muzaffarnagar', 'Bulandshahr', 'Ghaziabad', 'Meerut',
            'Gautam Buddha Nagar', 'Bagpat', 'Shamli', 'Bijnor', 'Moradabad',
            'Rampur', 'Amroha', 'Badaun', 'Bareilly', 'Pilibhit', 'Shahjahanpur',
            'Hardoi', 'Lakhimpur Kheri', 'Lucknow', 'Raebareli', 'Sitapur', 'Unnao',
            'Amethi', 'Hapur', 'Sambhal', 'Bahraich', 'Barabanki', 'Ayodhya', 'Gonda',
            'Sultanpur', 'Ambedkar Nagar', 'Shravasti', 'Balrampur', 'Azamgarh',
            'Basti', 'Deoria', 'Gorakhpur', 'Mau', 'Siddharth Nagar', 'Maharajganj',
            'Kushinagar', 'Sant Kabir Nagar', 'Ballia', 'Ghazipur', 'Jaunpur', 'Mirzapur',
            'Sonbhadra', 'Varanasi', 'Bhadohi', 'Chandauli', 'Prayagraj', 'Fatehpur',
            'Pratapgarh', 'Kaushambi', 'Kannauj', 'Etawah', 'Farrukhabad', 'Kanpur Dehat',
            'Kanpur Nagar', 'Auraiya', 'Agra', 'Aligarh', 'Etah', 'Firozabad', 'Mainpuri',
            'Mathura', 'Hathras', 'Kasganj', 'Banda', 'Hamirpur', 'Jalaun', 'Jhansi',
            'Lalitpur', 'Mahoba', 'Chitrakoot'
        ]
    },
    'uk': {
        name: 'Uttarakhand',
        code: 'UK',
        folder: 'uttarakhand',
        capital: 'Dehradun',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 20,
        districts: [
            'Almora', 'Bageshwar', 'Champawat', 'Nainital', 'Pithoragarh',
            'Udham Singh Nagar', 'Dehradun', 'Haridwar', 'Tehri Garhwal', 'Uttarkashi',
            'Chamoli', 'Pauri Garhwal', 'Rudraprayag'
        ]
    },
    'wb': {
        name: 'West Bengal',
        code: 'WB',
        folder: 'west-bengal',
        capital: 'Kolkata',
        wikipediaTitle: 'List of Regional Transport Office districts in India',
        totalRTOs: 97,
        districts: [
            'Kolkata', 'Howrah', 'Hooghly', 'South 24 Parganas', 'North 24 Parganas',
            'Purba Medinipur', 'Paschim Medinipur', 'Paschim Bardhaman',
            'Purba Bardhaman', 'Murshidabad', 'Uttar Dinajpur', 'Dakshin Dinajpur',
            'Cooch Behar', 'Malda', 'Bankura', 'Alipurduar', 'Jalpaiguri', 'Darjeeling',
            'Kalimpong', 'Purulia', 'Nadia', 'Jhargram', 'Birbhum'
        ]
    }
};

const FOLDER_TO_STATE_CODE: Record<string, string> = {};
for (const [stateCode, info] of Object.entries(STATE_CONFIG)) {
    FOLDER_TO_STATE_CODE[info.folder] = stateCode;
}

function resolveStateCode(input: string): string | null {
    const normalized = input.toLowerCase().trim();
    if (STATE_CONFIG[normalized]) return normalized;
    if (FOLDER_TO_STATE_CODE[normalized]) return FOLDER_TO_STATE_CODE[normalized];
    return null;
}

// ============================================================================
// Types
// ============================================================================

interface WikipediaRTO {
    code: string;
    location: string;
    rawText: string;
}

interface PopulateResult {
    code: string;
    success: boolean;
    data?: RTOData;
    error?: string;
    source: 'wikipedia' | 'gemini' | 'cached';
    saved?: boolean;
}

interface CLIOptions {
    dryRun: boolean;
    skipExisting: boolean;
    useSearch: boolean;
    verbose: boolean;
    force: boolean;
    stateCode: string;
    start: number;
    end: number;
}

// ============================================================================
// Validation
// ============================================================================

if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set');
    console.error('   Set it with: export GEMINI_API_KEY=your-api-key');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCode(stateCode: string, num: number): string {
    return `${stateCode.toUpperCase()}-${num.toString().padStart(2, '0')}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function rtoFileExists(stateFolder: string, code: string): boolean {
    const filePath = path.join(process.cwd(), 'data', stateFolder, `${code.toLowerCase()}.json`);
    return fs.existsSync(filePath);
}

function readExistingRTOData(stateFolder: string, code: string): RTOData | null {
    const filePath = path.join(process.cwd(), 'data', stateFolder, `${code.toLowerCase()}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as RTOData;
    } catch {
        return null;
    }
}

function ensureDirectoryExists(stateFolder: string): void {
    const dirPath = path.join(process.cwd(), 'data', stateFolder);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function saveRTOFile(stateFolder: string, data: RTOData): void {
    const filePath = path.join(process.cwd(), 'data', stateFolder, `${data.code.toLowerCase()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf-8');
}

interface StateConfigFile {
    stateCode: string;
    name: string;
    displayName: string;
    capital: string;
    totalRTOs: number;
    districtMapping: Record<string, string>;
    svgDistrictIds: string[];
    isComplete: boolean;
    type: 'state' | 'union-territory';
    validCodes?: string[];
}

function loadStateConfigFile(stateFolder: string): StateConfigFile | null {
    try {
        const configPath = path.join(process.cwd(), 'data', stateFolder, 'config.json');
        if (!fs.existsSync(configPath)) return null;
        return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as StateConfigFile;
    } catch {
        return null;
    }
}

function saveStateConfigFile(stateFolder: string, config: StateConfigFile): void {
    const configPath = path.join(process.cwd(), 'data', stateFolder, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4) + '\n', 'utf-8');
}

function countActualRTOFiles(stateFolder: string): number {
    const statePath = path.join(process.cwd(), 'data', stateFolder);
    if (!fs.existsSync(statePath)) return 0;

    const files = fs.readdirSync(statePath).filter(file =>
        file.endsWith('.json') &&
        !file.includes('index') &&
        !file.includes('config') &&
        !file.includes('raw-') &&
        !file.includes('validation-report') &&
        /^[a-z]{2}-\d+\.json$/i.test(file)
    );
    return files.length;
}

/**
 * Updates the state config.json with accurate totalRTOs and isComplete flags.
 * Called after population to ensure config reflects reality.
 */
function updateStateConfigAfterPopulation(
    stateFolder: string,
    processedRange: { start: number; end: number },
    totalExpected: number,
    results: PopulateResult[]
): void {
    const config = loadStateConfigFile(stateFolder);
    if (!config) {
        console.log(`   ⚠️  No config.json found for ${stateFolder}, skipping config update`);
        return;
    }

    // Count actual RTO files on disk
    const actualRTOCount = countActualRTOFiles(stateFolder);

    // Check if we've processed the full range (start=1 and end >= totalExpected)
    const processedFullRange = processedRange.start === 1 && processedRange.end >= totalExpected;

    // Count how many codes in this run were determined to not exist
    const notInUseCount = results.filter(r =>
        r.success && r.saved === false && r.data?.status === 'not-in-use'
    ).length;

    let configChanged = false;

    // If we processed the full range, we can confidently update totalRTOs
    if (processedFullRange) {
        const newTotalRTOs = actualRTOCount;

        if (config.totalRTOs !== newTotalRTOs) {
            console.log(`\n📝 Updating config.json: totalRTOs ${config.totalRTOs} → ${newTotalRTOs}`);
            console.log(`   (${notInUseCount} codes found to be not-in-use)`);
            config.totalRTOs = newTotalRTOs;
            configChanged = true;
        }

        // Since we processed all, mark as complete if we have RTOs
        if (!config.isComplete && newTotalRTOs > 0) {
            console.log(`   Setting isComplete = true`);
            config.isComplete = true;
            configChanged = true;
        }
    } else {
        // Partial range - check if actual count meets or exceeds expected
        // and all codes have been tried (no gaps)
        if (!config.isComplete && actualRTOCount >= config.totalRTOs && config.totalRTOs > 0) {
            console.log(`\n📝 Updating config.json: isComplete = true (${actualRTOCount}/${config.totalRTOs} RTOs)`);
            config.isComplete = true;
            configChanged = true;
        }
    }

    if (configChanged) {
        saveStateConfigFile(stateFolder, config);
        console.log(`   ✅ config.json updated`);
    }
}

// ============================================================================
// Wikipedia Fetching
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchWikipediaRTOSection(stateCode: string): Promise<string> {
    const mainPage = 'List of Regional Transport Office districts in India';

    const params = new URLSearchParams({
        action: 'parse',
        page: mainPage,
        format: 'json',
        prop: 'text',
        redirects: '1',
    });

    const response = await fetch(`${WIKIPEDIA_API}?${params}`);
    if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json() as { parse?: { text?: { '*'?: string } }; error?: { info: string } };

    if (data.error) {
        throw new Error(`Wikipedia error: ${data.error.info}`);
    }

    return data.parse?.text?.['*'] || '';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseRTOTableFromWikipedia(html: string, stateCode: string, stateName: string): WikipediaRTO[] {
    const rtos: WikipediaRTO[] = [];
    const codeUpper = stateCode.toUpperCase();
    const lines = html.split(/[\n\r]+/);

    for (const line of lines) {
        const codeMatch = line.match(new RegExp(`${codeUpper}[\\s\\-]*(\\d{1,2})`, 'i'));
        if (!codeMatch) continue;

        const num = parseInt(codeMatch[1], 10);
        if (isNaN(num) || num < 1 || num > 200) continue;

        const code = formatCode(stateCode, num);
        if (rtos.find(r => r.code === code)) continue;

        const cleanedLine = line
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&#160;/g, ' ')
            .replace(/\|/g, ' ')
            .replace(/\[[^\]]*\]/g, '')
            .replace(new RegExp(`${codeUpper}[\\s\\-]*\\d{1,2}`, 'gi'), '')
            .trim();

        const parts = cleanedLine.split(/\s{2,}/).filter(p => p.trim().length > 2);
        let location = parts.length > 0 ? parts[0].trim() : '';

        location = location
            .replace(/^\d+\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!location || location.match(/^\d+$/) || location.length < 2) {
            location = '';
        }

        rtos.push({ code, location, rawText: line });
    }

    rtos.sort((a, b) => {
        const numA = parseInt(a.code.split('-')[1], 10);
        const numB = parseInt(b.code.split('-')[1], 10);
        return numA - numB;
    });

    const uniqueRTOs = new Map<string, WikipediaRTO>();
    for (const rto of rtos) {
        const existing = uniqueRTOs.get(rto.code);
        if (!existing || (rto.location && !existing.location)) {
            uniqueRTOs.set(rto.code, rto);
        }
    }

    return Array.from(uniqueRTOs.values());
}

// ============================================================================
// Gemini Enrichment with Structured Output
// ============================================================================

async function enrichRTOWithGemini(
    code: string,
    locationHint: string,
    stateInfo: StateInfo,
    existingData?: RTOData | null,
    useSearch: boolean = false
): Promise<RTOData> {
    const searchInstruction = useSearch
        ? `\n\n## IMPORTANT: Use Google Search
You have access to Google Search. SEARCH for "${code} RTO" to find:
1. The correct city/location for this RTO code
2. The official address and contact details
3. The jurisdiction areas
Use the search results to provide accurate data.
`
        : '';

    let prompt: string;

    if (existingData) {
        prompt = `You are an expert on Indian Regional Transport Offices (RTOs) and vehicle registration systems.
${searchInstruction}
I have EXISTING DATA for the RTO ${code} that has been previously validated. Your task is to:
1. ${useSearch ? 'FIRST, search for "' + code + ' RTO" to verify the city/region is correct' : 'KEEP all the accurate information from the existing data (especially region, city, district, jurisdictionAreas)'}
2. ${useSearch ? 'If search results show a DIFFERENT city than the existing data, UPDATE the city/region/district accordingly' : 'ONLY correct obvious errors if you find any'}
3. **FILL IN any missing or placeholder fields** - look for "N/A", empty strings "", or generic values
4. Enhance the description if it's too generic

## IMPORTANT: ${useSearch ? 'Google Search results are the source of truth. If the existing data has the WRONG city, correct it!' : 'Trust the existing data as ground truth unless it\'s clearly wrong!'}

## Existing Data (treat as ground truth):
${JSON.stringify(existingData, null, 2)}

## Fields to Fill if Missing (currently "N/A" or empty):
- phone: Provide actual RTO phone number if you know it (format: STD-number, e.g., "0832-2262241")
- email: Provide actual RTO email if you know it (usually rto-xxx.state@nic.in or dyrto-xxx.state@nic.in)
- address: Provide complete address if current one is incomplete
- established: Year established if known
- pinCode: Correct 6-digit PIN code

## Additional Context:
- Wikipedia Location Hint: ${locationHint || 'Not available'}
- State: ${stateInfo.name} (${stateInfo.code})
- State Capital: ${stateInfo.capital}
- Available Districts: ${stateInfo.districts.join(', ')}

## Your Task:
1. Keep all existing accurate data (region, city, district, jurisdictionAreas are likely correct)
2. **Replace "N/A" values with actual data if you know it** - especially phone and email
3. Improve the description if it's too generic or placeholder-like
4. Validate the district is one of the available districts for this state

Return the complete RTO data with all fields filled.`;
    } else {
        prompt = `You are an expert on Indian Regional Transport Offices (RTOs) and vehicle registration systems.
${searchInstruction}
Generate complete and accurate data for the following RTO:

## RTO Information:
- Code: ${code}
- State: ${stateInfo.name} (${stateInfo.code})
- Wikipedia Location: ${locationHint || 'Unknown - please determine based on RTO code patterns'}
- State Capital: ${stateInfo.capital}
- Available Districts: ${stateInfo.districts.join(', ')}

## Task:
Determine if this RTO code exists and is currently in use.
If it exists, create a complete data object.
If it currently DOES NOT EXIST or is NOT IN USE, set "status" to "not-in-use".

## CRITICAL VALIDATION RULES:
1. **EXISTENCE CHECK**: Do not assume sequential numbering. Many states skip numbers.
2. **SEARCH VERIFICATION**: If you cannot find CLEAR evidence of "${code}" being a valid RTO code in search results or official lists, set status to "not-in-use".
3. **DO NOT GUESS**: Do not create a fake RTO just because a district exists. For example, if a district has an RTO but it uses a different code, do not assign it to "${code}".
4. **SIMILAR CODES**: Be careful of codes from other states (e.g. AN-03 vs AP-03). Ensure the State matches ${stateInfo.name}.
5. **STATUS "not-in-use"**: If the code is not found, return "status": "not-in-use" and meaningless/empty values for other fields.

## Important Guidelines:
- Be factually accurate based on your knowledge
- The Wikipedia location "${locationHint}" is the authoritative source for the city name
- If this is a well-known RTO (like state capital), provide detailed information
- If unsure about specific details, use reasonable defaults but mark status as needed
- For jurisdiction areas, list the actual talukas/mandals/areas covered
- The description should mention the RTO type (RTO/ARTO) and what it handles
- If the code appears to be not in use or reserved, set status to "not-in-use"`;
    }

    try {
        let searchContext = '';

        // If using Google Search, first make a search call to gather accurate information
        if (useSearch) {
            const searchPrompt = `Search for "${code} RTO" and "${code} Regional Transport Office ${stateInfo.name}".
OBJECTIVE: Verify if the RTO code "${code}" actually exists in ${stateInfo.name}.

Check for:
1. Does "${code}" appear in official ${stateInfo.name} transport department lists?
2. Is there a specific RTO office assigned to "${code}"?
3. If it exists, find the city/location, address, and jurisdiction.
4. Watch out for confusion with similar codes from other states (e.g. AP vs AN vs AR).

Summarize the factual findings. If no clear evidence is found, explicitly state that the code likely does not exist.`;

            const searchResponse = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: searchPrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            searchContext = searchResponse.text ?? '';
        }

        // Build the final prompt with search context if available
        const finalPrompt = useSearch && searchContext
            ? `${prompt}\n\n## Google Search Results (use this as your primary source):\n${searchContext}`
            : prompt;

        // Now make structured output call (cannot combine with tools)
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: finalPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: toGeminiSchema(RTODataSchema),
            },
        });

        const responseText = response.text ?? '{}';
        const parsed = RTODataSchema.parse(JSON.parse(responseText));

        // Ensure code matches and state info is correct
        return {
            ...parsed,
            code: code,
            state: stateInfo.name,
            stateCode: stateInfo.code,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Gemini enrichment failed: ${errorMsg}`);
    }
}

// ============================================================================
// Main Population Logic
// ============================================================================

async function populateRTO(
    code: string,
    locationHint: string,
    stateInfo: StateInfo,
    options: CLIOptions
): Promise<PopulateResult> {
    try {
        const existingData = readExistingRTOData(stateInfo.folder, code);

        if (existingData && !options.force) {
            if (options.skipExisting) {
                return { code, success: true, source: 'cached', error: 'Skipped (already exists)', saved: false };
            }
        }

        const data = await enrichRTOWithGemini(code, locationHint, stateInfo, existingData, options.useSearch);

        // Don't save if status is not-in-use (implies invalid or non-existent RTO)
        if (data.status === 'not-in-use' && !options.force) {
            return { code, success: true, data, source: 'gemini', saved: false };
        }

        if (!options.dryRun) {
            ensureDirectoryExists(stateInfo.folder);
            saveRTOFile(stateInfo.folder, data);
        }

        return { code, success: true, data, source: 'gemini', saved: true };
    } catch (error) {
        return {
            code,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            source: 'gemini',
            saved: false
        };
    }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): CLIOptions {
    const args = process.argv.slice(2);

    const options: CLIOptions = {
        dryRun: args.includes('--dry-run'),
        skipExisting: args.includes('--skip-existing'),
        useSearch: args.includes('--search'),
        verbose: args.includes('--verbose') || args.includes('-v'),
        force: args.includes('--force'),
        stateCode: '',
        start: 1,
        end: 0,
    };

    const positionalArgs = args.filter(arg => !arg.startsWith('-'));

    if (positionalArgs.length >= 1) {
        options.stateCode = positionalArgs[0].toLowerCase();
    }

    if (positionalArgs.length >= 2) {
        const secondArg = positionalArgs[1];
        const rtoCodeMatch = secondArg.match(/^([A-Za-z]{2})-(\d{1,3})$/i);
        if (rtoCodeMatch) {
            options.start = parseInt(rtoCodeMatch[2], 10);
            options.end = options.start;
        } else {
            options.start = parseInt(secondArg, 10) || 1;
        }
    }

    if (positionalArgs.length >= 3) {
        const thirdArg = positionalArgs[2];
        const rtoCodeMatch = thirdArg.match(/^([A-Za-z]{2})-(\d{1,3})$/i);
        if (rtoCodeMatch) {
            options.end = parseInt(rtoCodeMatch[2], 10);
        } else {
            options.end = parseInt(thirdArg, 10) || options.start;
        }
    } else if (positionalArgs.length === 2) {
        options.end = options.start;
    }

    return options;
}

function printHelp(): void {
    console.log(`
📦 RTO Data Population Script (using @google/genai + Zod)

Fetches RTO data from Wikipedia and enriches it with Gemini AI using structured
output to create complete, accurate JSON files.

Usage:
  bun scripts/populate-rto-data.ts <state> [start] [end] [options]

Arguments:
  state         State code OR folder name (e.g., ka, karnataka, kl, kerala)
  start         Starting RTO number (default: 1)
  end           Ending RTO number (default: all RTOs for the state)

Options:
  --dry-run        Preview without writing files
  --skip-existing  Skip RTOs that already have JSON files
  --search         Use Google Search grounding for better accuracy (recommended)
  --force          Overwrite existing files
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Examples:
  bun scripts/populate-rto-data.ts ga                    # All Goa RTOs (GA-01 to GA-12)
  bun scripts/populate-rto-data.ts kerala 1 10           # Kerala RTOs 1-10 (using folder name)
  bun scripts/populate-rto-data.ts kl 1 10               # Kerala RTOs 1-10 (using state code)
  bun scripts/populate-rto-data.ts kl 49 --search        # Single RTO with Google Search verification
  bun scripts/populate-rto-data.ts ga GA-07              # Single RTO GA-07 (using RTO code)
  bun scripts/populate-rto-data.ts ga 7                  # Single RTO GA-07 (using number)
  bun scripts/populate-rto-data.ts ga --dry-run          # Preview without saving
  bun scripts/populate-rto-data.ts ka 55                 # Single RTO KA-55
  bun scripts/populate-rto-data.ts tamil-nadu --skip-existing    # Only new RTOs

Supported States:
${Object.entries(STATE_CONFIG).map(([code, info]) => `  ${code.toUpperCase().padEnd(4)} | ${info.folder.padEnd(20)} - ${info.name} (${info.totalRTOs} RTOs)`).join('\n')}

Environment Variables:
  GEMINI_API_KEY   Your Google Gemini API key (required)

Data Sources:
  - Wikipedia for location hints and basic data
  - Gemini AI for enrichment, validation, and complete data generation
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
    const options = parseArgs();

    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printHelp();
        process.exit(0);
    }

    if (!options.stateCode) {
        printHelp();
        process.exit(1);
    }

    const resolvedStateCode = resolveStateCode(options.stateCode);
    if (!resolvedStateCode) {
        console.error(`❌ Unknown state code: ${options.stateCode}`);
        console.error(`   Supported state codes: ${Object.keys(STATE_CONFIG).join(', ')}`);
        console.error(`   Supported folder names: ${Object.values(STATE_CONFIG).map(s => s.folder).join(', ')}`);
        process.exit(1);
    }

    const stateInfo = STATE_CONFIG[resolvedStateCode];
    options.stateCode = resolvedStateCode;

    if (options.end === 0) {
        options.end = stateInfo.totalRTOs;
    }

    const total = options.end - options.start + 1;

    console.log(`
📦 RTO Data Population Script (using @google/genai + Zod)
${'='.repeat(60)}
State:        ${stateInfo.name} (${stateInfo.code})
Range:        ${formatCode(options.stateCode, options.start)} to ${formatCode(options.stateCode, options.end)}
Total:        ${total} RTO(s)
Mode:         ${options.dryRun ? '🔍 DRY RUN (no files will be written)' : '💾 WRITE MODE'}
Search:       ${options.useSearch ? '🔍 Google Search grounding enabled' : 'Disabled (use --search for better accuracy)'}
Skip Existing: ${options.skipExisting ? 'Yes' : 'No'}
${'='.repeat(60)}
`);

    console.log('📖 Fetching Wikipedia data for location hints...');
    let wikipediaRTOs: WikipediaRTO[] = [];

    try {
        const html = await fetchWikipediaRTOSection(options.stateCode);
        wikipediaRTOs = parseRTOTableFromWikipedia(html, options.stateCode, stateInfo.name);
        console.log(`   Found ${wikipediaRTOs.length} RTOs in Wikipedia data\n`);
    } catch (error) {
        console.log(`   ⚠️  Could not fetch Wikipedia data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('   Continuing with Gemini-only enrichment...\n');
    }

    const wikiLookup = new Map<string, string>();
    for (const rto of wikipediaRTOs) {
        wikiLookup.set(rto.code, rto.location);
    }

    const configPath = path.join(process.cwd(), 'data', stateInfo.folder, 'config.json');
    let validCodes: string[] | null = null;

    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.validCodes && Array.isArray(config.validCodes) && config.validCodes.length > 0) {
                validCodes = config.validCodes;
                console.log(`📋 Using valid codes list from config (${config.validCodes.length} codes)`);
                console.log(`   Sample codes: ${config.validCodes.slice(0, 5).join(', ')}...\n`);
            }
        } catch (error) {
            console.log(`   ⚠️  Could not load valid codes from config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    let codesToProcess: string[];

    if (validCodes && validCodes.length > 0) {
        const startIdx = options.start - 1;
        const endIdx = options.end;
        codesToProcess = validCodes.slice(startIdx, endIdx);

        if (codesToProcess.length === 0) {
            console.error(`❌ No valid codes found in range ${options.start} to ${options.end}`);
            console.error(`   Total valid codes: ${validCodes.length}`);
            process.exit(1);
        }
    } else {
        console.log(`⚠️  No valid codes list found - using sequential generation`);
        console.log(`   This may create invalid codes if RTO numbering is non-sequential!\n`);
        codesToProcess = [];
        for (let i = options.start; i <= options.end; i++) {
            codesToProcess.push(formatCode(options.stateCode, i));
        }
    }

    console.log(`📝 Processing ${codesToProcess.length} RTO code(s): ${codesToProcess[0]}${codesToProcess.length > 1 ? ` to ${codesToProcess[codesToProcess.length - 1]}` : ''}\n`);

    const results: PopulateResult[] = [];
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const code of codesToProcess) {
        const locationHint = wikiLookup.get(code) || '';

        process.stdout.write(`⏳ ${code}${locationHint ? ` (${locationHint})` : ''} ... `);

        const result = await populateRTO(code, locationHint, stateInfo, options);
        results.push(result);

        if (result.success) {
            if (result.source === 'cached') {
                console.log('⏭️  Skipped (exists)');
                skipCount++;
            } else if (result.saved === false) {
                console.log(`⚠️  Status: 'not-in-use' (skipped creation)`);
                // Still counting as success since we successfully determined it doesn't exist
                successCount++;
            } else {
                const statusInfo = result.data?.status === 'not-in-use' ? ' [not-in-use]' : '';
                console.log(`✅ ${result.data?.region || 'Unknown'}${statusInfo}`);

                if (options.verbose && result.data) {
                    console.log(`   District: ${result.data.district || 'Unknown'}`);
                    console.log(`   Division: ${result.data.division || 'Unknown'}`);
                    console.log(`   Areas: ${result.data.jurisdictionAreas.slice(0, 3).join(', ')}${result.data.jurisdictionAreas.length > 3 ? '...' : ''}`);
                }

                if (options.dryRun && options.verbose && result.data) {
                    console.log(`\n   📄 Would write:`);
                    console.log(JSON.stringify(result.data, null, 4).split('\n').map(l => '   ' + l).join('\n'));
                    console.log();
                }

                successCount++;
            }
        } else {
            console.log(`❌ ${result.error}`);
            failCount++;
        }

        const isLastCode = code === codesToProcess[codesToProcess.length - 1];
        if (!isLastCode) {
            await sleep(API_DELAY_MS);
        }
    }

    console.log(`
${'='.repeat(60)}
📊 Summary
${'='.repeat(60)}
✅ Successful: ${successCount}
⏭️  Skipped:    ${skipCount}
❌ Failed:     ${failCount}
📁 Total:      ${total}
${'='.repeat(60)}`);

    // Update config.json with accurate totalRTOs and isComplete flags
    if (!options.dryRun) {
        updateStateConfigAfterPopulation(
            stateInfo.folder,
            { start: options.start, end: options.end },
            stateInfo.totalRTOs,
            results
        );
    }

    if (!options.dryRun && successCount > 0) {
        console.log(`
💡 Next steps:
   1. Review the generated files in data/${stateInfo.folder}/
   2. Run: bun scripts/generate-index.ts
   3. Optionally validate: bun scripts/validate-and-fix-rto-data.ts ${stateInfo.folder}
   4. Generate images: bun scripts/generate-rto-images.ts --state=${stateInfo.folder}
   5. Test: bun run dev
`);
    }

    if (failCount > 0) {
        console.log('\nFailed RTOs:');
        for (const result of results) {
            if (!result.success) {
                console.log(`  - ${result.code}: ${result.error}`);
            }
        }
    }
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
