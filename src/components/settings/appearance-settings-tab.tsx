
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from 'next-themes';

interface AppearanceSettingsTabContentProps {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  mounted: boolean;
}

export function AppearanceSettingsTabContent({ theme, setTheme, mounted }: AppearanceSettingsTabContentProps) {
    if (!mounted) {
        return null; // Or a skeleton loader
    }
    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of the application.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <h3 className="text-md font-medium">Theme</h3>
                    <p className="text-sm text-muted-foreground">Select the theme for the application dashboard.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <Button
                        variant={theme === 'light' ? 'default' : 'outline'}
                        onClick={() => setTheme('light')}
                    >
                        <Sun className="mr-2 h-4 w-4" /> Light
                    </Button>
                    <Button
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        onClick={() => setTheme('dark')}
                    >
                        <Moon className="mr-2 h-4 w-4" /> Dark
                    </Button>
                    <Button
                        variant={theme === 'system' ? 'default' : 'outline'}
                        onClick={() => setTheme('system')}
                    >
                        <Laptop className="mr-2 h-4 w-4" /> System
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
