import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProviderCard from './ProviderCard';
import type { Provider } from '../types';
const provider: Provider = { id:'provider_1',bio:'Helpful tutor',skills:['Math'],experienceYears:5,serviceRadiusKm:5,averageRating:4.9,reviewCount:10,completedJobs:20,verificationStatus:'VERIFIED',portfolioUrls:[],isAcceptingWork:true,user:{id:'u1',fullName:'Ananya Iyer',neighborhood:'Central Area'},services:[{id:'s1',title:'Math Tutoring',description:'One-to-one support',price:600,durationMin:60,category:{id:'c1',name:'Tutoring',slug:'tutoring'}}],availability:[],startingPrice:600,distance:1.2,recommendationScore:99 };
describe('ProviderCard', () => { it('shows provider trust and price information', () => { render(<MemoryRouter><ProviderCard provider={provider}/></MemoryRouter>); expect(screen.getByText('Ananya Iyer')).toBeTruthy(); expect(screen.getByText('₹600')).toBeTruthy(); expect(screen.getByText('Verified')).toBeTruthy(); }); });
